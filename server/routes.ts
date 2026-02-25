import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { pool } from "./db";
import type { UserWithRoles } from "@shared/schema";

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = "41Tech@2026";
const DEFAULT_PASSWORD_SETTING_KEY = "DEFAULT_LOCAL_PASSWORD";

// Password validation: min 10 chars, 1 upper, 1 lower, 1 number, 1 special
const passwordSchema = z.string()
  .min(10, "Senha deve ter no mínimo 10 caracteres")
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Senha deve conter pelo menos um caractere especial");

// Rate limiting store (simple in-memory for now)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Configure multer for photo uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${req.user?.id || "unknown"}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are allowed"));
    }
  },
});

const ticketUploadDir = path.join(process.cwd(), "uploads", "tickets");
if (!fs.existsSync(ticketUploadDir)) {
  fs.mkdirSync(ticketUploadDir, { recursive: true });
}

const ticketAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ticketUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const rand = crypto.randomBytes(8).toString("hex");
    const filename = `${req.params.id}-${Date.now()}-${rand}${ext}`;
    cb(null, filename);
  },
});

const ticketUpload = multer({
  storage: ticketAttachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and PDF files are allowed"));
    }
  },
});

// Validation schemas
const createSectorSchema = z.object({
  name: z.string().min(1).max(255),
});

const updateSectorSchema = z.object({
  name: z.string().min(1).max(255),
});

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  sectorId: z.string().uuid().optional(),
  sectorIds: z.array(z.string().uuid()).optional(),
  roleName: z.enum(["Admin", "Coordenador", "Usuario"]).optional(),
  authProvider: z.enum(["entra", "local"]).optional().default("entra"),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  themePref: z.enum(["light", "dark"]).optional(),
  sectorIds: z.array(z.string().uuid()).optional(),
  roleName: z.enum(["Admin", "Coordenador", "Usuario"]).optional(),
});

const createResourceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["APP", "DASHBOARD"]),
  sectorId: z.string().uuid().nullable().optional(),
  embedMode: z.enum(["LINK", "IFRAME", "POWERBI"]).optional(),
  openBehavior: z.enum(["HUB_ONLY", "NEW_TAB_ONLY", "BOTH"]).optional(),
  url: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateResourceSchema = createResourceSchema.partial();

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserWithRoles;
    }
  }
}

// Session configuration
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Auth middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await storage.getUserWithRoles(req.session.userId);
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;
  next();
}

// Admin middleware - only full admins can access all admin routes
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

// Coordinator or Admin middleware - coordinators can manage their sectors
async function requireAdminOrCoordinator(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    const isCoordinator = req.user?.roles?.some(r => r.roleName === "Coordenador");
    if (!isCoordinator) {
      return res.status(403).json({ error: "Forbidden - Admin or Coordinator access required" });
    }
  }
  next();
}

// Helper to check if coordinator can manage a sector
function canCoordinatorManageSector(user: UserWithRoles, sectorId: string): boolean {
  if (user.isAdmin) return true;
  return user.roles?.some(r => r.roleName === "Coordenador" && r.sectorId === sectorId) || false;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Session secret validation - required in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }

  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: sessionSecret || "41hub-dev-only-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // ==================== AUTH ROUTES ====================

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUserWithRoles(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    res.json(user);
  });

  // Development login - simulates Entra ID login
  // In production, this would redirect to Microsoft Entra ID OAuth flow
  app.get("/api/auth/login", async (req, res) => {
    // In production, this endpoint should redirect to Microsoft Entra ID OAuth
    // For now, we implement dev auto-login only in development mode
    if (process.env.NODE_ENV === "production") {
      // In production, implement proper OAuth flow with Entra ID
      return res.status(501).json({ 
        error: "Microsoft Entra ID authentication not configured",
        message: "Configure AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID" 
      });
    }

    // Development: auto-login as first admin user
    let adminUser = await storage.getUserByEmail(process.env.ENTRA_ADMIN_EMAIL || "admin@41tech.com.br");
    
    if (!adminUser) {
      const allUsers = await storage.getAllUsers();
      if (allUsers.length > 0) {
        adminUser = allUsers[0];
      }
    }

    if (!adminUser) {
      return res.status(500).json({ error: "No users available. Run seed script first." });
    }

    req.session.userId = adminUser.id;
    
    await storage.createAuditLog({
      actorUserId: adminUser.id,
      action: "login",
      ip: req.ip || req.socket.remoteAddress,
    });

    res.redirect("/");
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    
    if (userId) {
      await storage.createAuditLog({
        actorUserId: userId,
        action: "logout",
        ip: req.ip || req.socket.remoteAddress,
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // ==================== LOCAL AUTH ROUTES ====================

  // Local login
  app.post("/api/auth/local/login", async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      
      // Rate limiting
      const now = Date.now();
      const attempts = loginAttempts.get(ip);
      if (attempts) {
        if (now < attempts.resetAt) {
          if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            return res.status(429).json({ error: "Muitas tentativas de login. Tente novamente em 1 minuto." });
          }
        } else {
          loginAttempts.set(ip, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
        }
      } else {
        loginAttempts.set(ip, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
      }

      const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      });

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
      }

      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);

      // Increment attempts
      const currentAttempts = loginAttempts.get(ip)!;
      currentAttempts.count++;

      if (!user) {
        await storage.createAuditLog({
          actorUserId: null,
          action: "local_login_failed",
          metadata: { email, reason: "user_not_found" },
          ip,
        });
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      if (user.authProvider !== "local") {
        await storage.createAuditLog({
          actorUserId: user.id,
          action: "local_login_failed",
          metadata: { reason: "wrong_auth_provider" },
          ip,
        });
        return res.status(401).json({ error: "Use o login Microsoft para esta conta" });
      }

      if (!user.isActive) {
        await storage.createAuditLog({
          actorUserId: user.id,
          action: "local_login_failed",
          metadata: { reason: "account_inactive" },
          ip,
        });
        return res.status(401).json({ error: "Conta desativada. Contate o administrador." });
      }

      if (!user.passwordHash) {
        await storage.createAuditLog({
          actorUserId: user.id,
          action: "local_login_failed",
          metadata: { reason: "no_password_set" },
          ip,
        });
        return res.status(401).json({ error: "Senha não configurada. Contate o administrador." });
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        await storage.createAuditLog({
          actorUserId: user.id,
          action: "local_login_failed",
          metadata: { reason: "wrong_password" },
          ip,
        });
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      // Success - reset rate limit
      loginAttempts.delete(ip);

      req.session.userId = user.id;

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "local_login_success",
        ip,
      });

      const userWithRoles = await storage.getUserWithRoles(user.id);
      res.json(userWithRoles);
    } catch (error) {
      console.error("Local login error:", error);
      res.status(500).json({ error: "Erro interno ao fazer login" });
    }
  });

  // Change password (for local users)
  app.post("/api/auth/local/change-password", requireAuth, async (req, res) => {
    try {
      if (req.user!.authProvider !== "local") {
        return res.status(400).json({ error: "Apenas usuários locais podem alterar senha por aqui" });
      }

      const changePasswordSchema = z.object({
        currentPassword: z.string().optional(),
        newPassword: passwordSchema,
      });

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.errors });
      }

      const { currentPassword, newPassword } = parsed.data;
      const user = await storage.getUser(req.user!.id);

      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: "Usuário não encontrado ou senha não configurada" });
      }

      // If not forced to change password, require current password
      if (!user.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: "Senha atual é obrigatória" });
        }
        const currentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!currentMatch) {
          return res.status(401).json({ error: "Senha atual incorreta" });
        }
      }

      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      await storage.updateUser(user.id, {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordUpdatedAt: new Date(),
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "local_password_changed",
        targetType: "user",
        targetId: user.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      const userWithRoles = await storage.getUserWithRoles(user.id);
      res.json(userWithRoles);
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Erro ao alterar senha" });
    }
  });

  // ==================== USER ROUTES ====================

  // Update current user preferences (theme, whatsapp)
  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const updateMeSchema = z.object({
        themePref: z.enum(["light", "dark"]).optional(),
        whatsapp: z.string().min(8).max(20).nullable().optional(),
      });

      const parsed = updateMeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const updates: Record<string, any> = {};
      if (parsed.data.themePref !== undefined) {
        updates.themePref = parsed.data.themePref;
      }
      if (parsed.data.whatsapp !== undefined) {
        updates.whatsapp = parsed.data.whatsapp;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      await storage.updateUser(req.user!.id, updates);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_update_profile",
        targetType: "user",
        targetId: req.user!.id,
        metadata: updates,
        ip: req.ip || req.socket.remoteAddress,
      });

      const userWithRoles = await storage.getUserWithRoles(req.user!.id);
      res.json(userWithRoles);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Upload user photo
  app.post("/api/users/me/photo", requireAuth, upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      const photoUrl = `/api/uploads/${req.file.filename}`;
      await storage.updateUser(req.user!.id, { photoUrl });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_upload_photo",
        targetType: "user",
        targetId: req.user!.id,
        metadata: { photoUrl },
        ip: req.ip || req.socket.remoteAddress,
      });

      const userWithRoles = await storage.getUserWithRoles(req.user!.id);
      res.json({ photoUrl, user: userWithRoles });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // Get team members (same sector)
  app.get("/api/users/team", requireAuth, async (req, res) => {
    try {
      const team = await storage.getTeamMembers(req.user!.id);
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // Get directory of users (with filtering)
  app.get("/api/users/directory", requireAuth, async (req, res) => {
    try {
      const sectorId = req.query.sectorId as string | undefined;
      const query = req.query.q as string | undefined;
      const showAll = req.query.all === "true";

      const directory = await storage.getDirectory({
        userId: req.user!.id,
        sectorId,
        query,
        showAll,
      });

      res.json(directory);
    } catch (error) {
      console.error("Error fetching directory:", error);
      res.status(500).json({ error: "Failed to fetch directory" });
    }
  });

  // Serve uploaded files (authenticated)
  app.get("/api/uploads/:filename", requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Security: prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });

  // ==================== RESOURCE ROUTES ====================

  // Get all resources for current user
  app.get("/api/resources", requireAuth, async (req, res) => {
    try {
      const resources = await storage.getResourcesForUser(req.user!.id);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  // Get recent access
  app.get("/api/resources/recent", requireAuth, async (req, res) => {
    try {
      const recent = await storage.getRecentAccess(req.user!.id, 5);
      res.json(recent);
    } catch (error) {
      console.error("Error fetching recent access:", error);
      res.status(500).json({ error: "Failed to fetch recent access" });
    }
  });

  // Get single resource
  app.get("/api/resources/:id", requireAuth, async (req, res) => {
    try {
      const resource = await storage.getResourceWithHealth(req.params.id, req.user!.id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      console.error("Error fetching resource:", error);
      res.status(500).json({ error: "Failed to fetch resource" });
    }
  });

  // Record resource access
  app.post("/api/resources/:id/access", requireAuth, async (req, res) => {
    try {
      await storage.recordAccess(req.user!.id, req.params.id);
      
      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "resource_access",
        targetType: "resource",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error recording access:", error);
      res.status(500).json({ error: "Failed to record access" });
    }
  });

  // Proxy route for iframe resources (placeholder for production reverse proxy)
  app.get("/api/proxy/:id", requireAuth, async (req, res) => {
    try {
      const resource = await storage.getResource(req.params.id);
      if (!resource || !resource.url) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // In production, this would proxy to the internal resource
      // For now, redirect to the URL (won't work for most internal apps)
      res.redirect(resource.url);
    } catch (error) {
      console.error("Error proxying resource:", error);
      res.status(500).json({ error: "Failed to proxy resource" });
    }
  });

  // ==================== FAVORITES ROUTES ====================

  // Get user's favorites
  app.get("/api/favorites", requireAuth, async (req, res) => {
    try {
      const favorites = await storage.getUserFavorites(req.user!.id);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // Add favorite
  app.post("/api/favorites/:resourceId", requireAuth, async (req, res) => {
    try {
      const favorite = await storage.addFavorite({
        userId: req.user!.id,
        resourceId: req.params.resourceId,
      });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "favorite_add",
        targetType: "resource",
        targetId: req.params.resourceId,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  // Remove favorite
  app.delete("/api/favorites/:resourceId", requireAuth, async (req, res) => {
    try {
      await storage.removeFavorite(req.user!.id, req.params.resourceId);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "favorite_remove",
        targetType: "resource",
        targetId: req.params.resourceId,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  // --- Settings ---
  app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const settingsMap: Record<string, string> = {};
      for (const s of allSettings) {
        settingsMap[s.key] = s.value;
      }
      // Provide default if not set
      if (!settingsMap[DEFAULT_PASSWORD_SETTING_KEY]) {
        settingsMap[DEFAULT_PASSWORD_SETTING_KEY] = DEFAULT_PASSWORD;
      }
      res.json(settingsMap);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settingsSchema = z.object({
        DEFAULT_LOCAL_PASSWORD: z.string().min(1).optional(),
      });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      if (parsed.data.DEFAULT_LOCAL_PASSWORD) {
        await storage.setSetting(DEFAULT_PASSWORD_SETTING_KEY, parsed.data.DEFAULT_LOCAL_PASSWORD);
      }

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "settings_update",
        metadata: { keys: Object.keys(parsed.data) },
        ip: req.ip || req.socket.remoteAddress,
      });

      // Return updated settings
      const allSettings = await storage.getAllSettings();
      const settingsMap: Record<string, string> = {};
      for (const s of allSettings) {
        settingsMap[s.key] = s.value;
      }
      res.json(settingsMap);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Admin stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // --- Sectors ---
  app.get("/api/admin/sectors", requireAuth, requireAdmin, async (req, res) => {
    try {
      const sectors = await storage.getAllSectors();
      res.json(sectors);
    } catch (error) {
      console.error("Error fetching sectors:", error);
      res.status(500).json({ error: "Failed to fetch sectors" });
    }
  });

  app.post("/api/admin/sectors", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = createSectorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const sector = await storage.createSector(parsed.data);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "sector_create",
        targetType: "sector",
        targetId: sector.id,
        metadata: { name: sector.name },
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(sector);
    } catch (error) {
      console.error("Error creating sector:", error);
      res.status(500).json({ error: "Failed to create sector" });
    }
  });

  app.patch("/api/admin/sectors/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = updateSectorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const sector = await storage.updateSector(req.params.id, parsed.data);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "sector_update",
        targetType: "sector",
        targetId: req.params.id,
        metadata: parsed.data,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(sector);
    } catch (error) {
      console.error("Error updating sector:", error);
      res.status(500).json({ error: "Failed to update sector" });
    }
  });

  app.delete("/api/admin/sectors/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteSector(req.params.id);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "sector_delete",
        targetType: "sector",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sector:", error);
      res.status(500).json({ error: "Failed to delete sector" });
    }
  });

  // --- Users ---
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersWithRoles();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const { email, name, sectorId, sectorIds, roleName, authProvider } = parsed.data;

      // For local users, set password hash from default password
      let passwordHash: string | undefined;
      let mustChangePassword = false;

      if (authProvider === "local") {
        const defaultPwdSetting = await storage.getSetting(DEFAULT_PASSWORD_SETTING_KEY);
        const defaultPassword = defaultPwdSetting?.value || DEFAULT_PASSWORD;
        passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
        mustChangePassword = true;
      }

      // Create user
      const user = await storage.createUser({ 
        email, 
        name, 
        authProvider: authProvider || "entra",
        passwordHash,
        mustChangePassword,
      } as any);

      // Handle sectorIds array (multi-sector support) or fallback to single sectorId
      const sectorsToAssign = sectorIds && sectorIds.length > 0 
        ? sectorIds 
        : (sectorId ? [sectorId] : []);

      if (sectorsToAssign.length > 0 && roleName) {
        const role = await storage.getRoleByName(roleName);
        if (role) {
          for (const sid of sectorsToAssign) {
            await storage.addUserSectorRole({
              userId: user.id,
              sectorId: sid,
              roleId: role.id,
            });
          }
        }
      }

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_create",
        targetType: "user",
        targetId: user.id,
        metadata: { email, name, sectorIds: sectorsToAssign },
        ip: req.ip || req.socket.remoteAddress,
      });

      const userWithRoles = await storage.getUserWithRoles(user.id);
      res.json(userWithRoles);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const { sectorIds, roleName, ...userUpdates } = parsed.data;
      const userId = req.params.id as string;

      // Update basic user info if provided
      if (Object.keys(userUpdates).length > 0) {
        await storage.updateUser(userId, userUpdates);
      }

      // Handle sector reassignment if sectorIds provided (even empty array to clear all)
      if (sectorIds !== undefined) {
        // Remove existing sector-role assignments
        const existingRoles = await storage.getUserSectorRoles(userId);
        for (const existing of existingRoles) {
          await storage.removeUserSectorRole(userId, existing.sectorId);
        }

        // Add new sector-role assignments if any sectors selected
        if (sectorIds.length > 0 && roleName) {
          const role = await storage.getRoleByName(roleName);
          if (role) {
            for (const sectorId of sectorIds) {
              await storage.addUserSectorRole({
                userId,
                sectorId,
                roleId: role.id,
              });
            }
          }
        }
      }

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_update",
        targetType: "user",
        targetId: userId,
        metadata: parsed.data,
        ip: req.ip || req.socket.remoteAddress,
      });

      const userWithRoles = await storage.getUserWithRoles(userId);
      res.json(userWithRoles);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Reset password (for local users only)
  app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      if (user.authProvider !== "local") {
        return res.status(400).json({ error: "Apenas usuários locais podem ter senha resetada" });
      }

      const defaultPwdSetting = await storage.getSetting(DEFAULT_PASSWORD_SETTING_KEY);
      const defaultPassword = defaultPwdSetting?.value || DEFAULT_PASSWORD;
      const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

      await storage.updateUser(userId, {
        passwordHash,
        mustChangePassword: true,
        passwordUpdatedAt: null,
      } as any);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_password_reset",
        targetType: "user",
        targetId: userId,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Falha ao resetar senha" });
    }
  });

  // Set password (admin can set password for local users)
  app.post("/api/admin/users/:id/set-password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      if (user.authProvider !== "local") {
        return res.status(400).json({ error: "Apenas usuários locais podem ter senha definida" });
      }

      const setPasswordSchema = z.object({
        newPassword: passwordSchema,
      });

      const parsed = setPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Senha inválida", details: parsed.error.errors });
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);

      await storage.updateUser(userId, {
        passwordHash,
        mustChangePassword: false,
        passwordUpdatedAt: new Date(),
      } as any);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "user_password_set",
        targetType: "user",
        targetId: userId,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error setting password:", error);
      res.status(500).json({ error: "Falha ao definir senha" });
    }
  });

  // --- Resources ---
  app.get("/api/admin/resources", requireAuth, requireAdmin, async (req, res) => {
    try {
      const resources = await storage.getAllResources();
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  app.post("/api/admin/resources", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = createResourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const resource = await storage.createResource(parsed.data as any);

      // Initialize health check as UP
      await storage.upsertHealthCheck(resource.id, "UP");

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "resource_create",
        targetType: "resource",
        targetId: resource.id,
        metadata: { name: resource.name, type: resource.type },
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(resource);
    } catch (error) {
      console.error("Error creating resource:", error);
      res.status(500).json({ error: "Failed to create resource" });
    }
  });

  app.patch("/api/admin/resources/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = updateResourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }

      const resource = await storage.updateResource(req.params.id, parsed.data as any);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "resource_update",
        targetType: "resource",
        targetId: req.params.id,
        metadata: parsed.data,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(resource);
    } catch (error) {
      console.error("Error updating resource:", error);
      res.status(500).json({ error: "Failed to update resource" });
    }
  });

  app.delete("/api/admin/resources/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteResource(req.params.id);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "resource_delete",
        targetType: "resource",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  // --- Audit Logs ---
  app.get("/api/admin/audit", requireAuth, requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getAuditLogsWithActors(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ==================== TICKET ROUTES ====================

  app.get("/api/tickets/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.listTicketCategoriesActive();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        q: req.query.q as string | undefined,
        includeClosed: req.query.includeClosed === "true",
      };
      const ticketList = await storage.listTicketsForUser(req.user!, filters);
      res.json(ticketList);
    } catch (error) {
      console.error("Error listing tickets:", error);
      res.status(500).json({ error: "Failed to list tickets" });
    }
  });

  app.post("/api/tickets", requireAuth, requireAdminOrCoordinator, async (req, res) => {
    try {
      const createTicketSchema = z.object({
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        requesterSectorId: z.string().min(1),
        categoryId: z.string().min(1),
        priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
        relatedResourceId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      });

      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      if (!req.user!.isAdmin) {
        const coordSectorIds = req.user!.roles
          .filter(r => r.roleName === "Coordenador")
          .map(r => r.sectorId);
        if (!coordSectorIds.includes(parsed.data.requesterSectorId)) {
          return res.status(403).json({ error: "Coordenador só pode criar chamados para setores que coordena" });
        }
      }

      const ticket = await storage.createTicket(parsed.data, req.user!);

      try {
        const enabled = await storage.isNotificationEnabled("ticket_created");
        if (enabled) {
          const allAdmins = await storage.getAdminUserIds();
          const recipients = allAdmins.filter(id => id !== req.user!.id);
          if (recipients.length > 0) {
            await storage.createNotifications(recipients, {
              type: "ticket_created",
              title: "Novo chamado criado",
              message: `${req.user!.name} criou o chamado: ${parsed.data.title}`,
              linkUrl: `/tickets/${ticket.id}`,
            });
          }
        }
      } catch (notifErr) {
        console.error("Error dispatching ticket_created notification:", notifErr);
      }

      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ error: error.message || "Failed to create ticket" });
    }
  });

  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.patch("/api/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const patchSchema = z.object({
        status: z.enum(["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_USUARIO", "RESOLVIDO", "CANCELADO"]).optional(),
        priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
        categoryId: z.string().optional(),
        relatedResourceId: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().min(1).optional(),
        resolutionDueAtManual: z.string().optional(),
        resolutionDueAtManualReason: z.string().optional(),
      });

      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      const { resolutionDueAtManual, resolutionDueAtManualReason, ...ticketPatch } = parsed.data;

      if (resolutionDueAtManual) {
        await storage.updateSlaCycleDeadline(req.params.id, {
          resolutionDueAt: new Date(resolutionDueAtManual),
          reason: resolutionDueAtManualReason,
          updatedBy: req.user!.id,
        });
      }

      const updated = await storage.adminUpdateTicket(req.params.id, ticketPatch, req.user!);
      if (!updated) return res.status(404).json({ error: "Chamado não encontrado" });

      if (ticketPatch.status) {
        try {
          const enabled = await storage.isNotificationEnabled("ticket_status");
          if (enabled) {
            const statusLabels: Record<string, string> = {
              ABERTO: "Aberto", EM_ANDAMENTO: "Em andamento",
              AGUARDANDO_USUARIO: "Aguardando usuário", RESOLVIDO: "Resolvido", CANCELADO: "Cancelado"
            };
            const assignees = await storage.getTicketAssigneeIds(req.params.id);
            const recipients = [updated.createdBy, ...assignees].filter(
              (id, i, arr) => id !== req.user!.id && arr.indexOf(id) === i
            );
            if (recipients.length > 0) {
              await storage.createNotifications(recipients, {
                type: "ticket_status",
                title: "Status do chamado alterado",
                message: `Chamado #${updated.number} alterado para: ${statusLabels[ticketPatch.status] || ticketPatch.status}`,
                linkUrl: `/tickets/${updated.id}`,
              });
            }
          }
        } catch (notifErr) {
          console.error("Error dispatching ticket_status notification:", notifErr);
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: error.message || "Failed to update ticket" });
    }
  });

  app.put("/api/tickets/:id/assignees", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({ assigneeIds: z.array(z.string()) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

      const adminUsers = await storage.getAdminUserIds();
      for (const aid of parsed.data.assigneeIds) {
        if (!adminUsers.includes(aid) && aid !== ticket.createdBy) {
          return res.status(400).json({ error: `Responsável ${aid} deve ser admin ou o requerente do chamado` });
        }
      }

      await storage.adminSetAssignees(req.params.id, parsed.data.assigneeIds, req.user!);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error setting assignees:", error);
      res.status(500).json({ error: error.message || "Failed to set assignees" });
    }
  });

  app.get("/api/tickets/:id/comments", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
      const comments = await storage.listTicketComments(req.params.id, req.user!);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/tickets/:id/comments", requireAuth, async (req, res) => {
    try {
      const isUser = !req.user!.isAdmin && !req.user!.roles?.some(r => r.roleName === "Coordenador");
      if (isUser) {
        return res.status(403).json({ error: "Usuários não podem comentar em chamados" });
      }

      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

      const commentSchema = z.object({
        body: z.string().min(1),
        isInternal: z.boolean().optional(),
      });
      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const comment = await storage.addTicketComment(req.params.id, req.user!, parsed.data);

      try {
        const enabled = await storage.isNotificationEnabled("ticket_comment");
        if (enabled && !parsed.data.isInternal) {
          const assignees = await storage.getTicketAssigneeIds(req.params.id);
          const recipients = [ticket.createdBy, ...assignees].filter(
            (id, i, arr) => id !== req.user!.id && arr.indexOf(id) === i
          );
          if (recipients.length > 0) {
            await storage.createNotifications(recipients, {
              type: "ticket_comment",
              title: "Novo comentário no chamado",
              message: `${req.user!.name} comentou no chamado #${ticket.number}: ${ticket.title}`,
              linkUrl: `/tickets/${ticket.id}`,
            });
          }
        }
      } catch (notifErr) {
        console.error("Error dispatching ticket_comment notification:", notifErr);
      }

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error adding comment:", error);
      res.status(400).json({ error: error.message || "Failed to add comment" });
    }
  });

  app.get("/api/tickets/:id/attachments", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });
      const attachments = await storage.listTicketAttachments(req.params.id, req.user!);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/tickets/:id/attachments", requireAuth, ticketUpload.single("file"), async (req, res) => {
    try {
      const isUser = !req.user!.isAdmin && !req.user!.roles?.some(r => r.roleName === "Coordenador");
      if (isUser) {
        return res.status(403).json({ error: "Usuários não podem enviar anexos" });
      }

      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const attachment = await storage.addTicketAttachment(req.params.id, req.user!, {
        originalName: req.file.originalname,
        storageName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
      res.status(201).json(attachment);
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      res.status(400).json({ error: error.message || "Failed to upload attachment" });
    }
  });

  app.get("/api/tickets/:id/attachments/:attachmentId/download", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicketDetail(req.params.id, req.user!);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

      const attachments = await storage.listTicketAttachments(req.params.id, req.user!);
      const attachment = attachments.find(a => a.id === req.params.attachmentId);
      if (!attachment) return res.status(404).json({ error: "Anexo não encontrado" });

      if (attachment.storageName.includes("..") || attachment.storageName.includes("/") || attachment.storageName.includes("\\")) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      const filePath = path.join(ticketUploadDir, attachment.storageName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalName}"`);
      res.setHeader("Content-Type", attachment.mimeType);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ error: "Failed to download attachment" });
    }
  });

  // ==================== ADMIN TICKET ROUTES ====================

  app.get("/api/admin/tickets/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
      const categories = await storage.listAllTicketCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/tickets/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(255),
        branch: z.string().min(1).max(120),
        parentId: z.string().nullable().optional(),
        descriptionTemplate: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      if (parsed.data.parentId) {
        const allCats = await storage.listAllTicketCategories();
        const parent = allCats.find(c => c.id === parsed.data.parentId);
        if (!parent || parent.parentId !== null) {
          return res.status(400).json({ error: "Categoria pai deve ser uma branch (raiz)" });
        }
      }

      const cat = await storage.createTicketCategory({
        ...parsed.data,
        createdBy: req.user!.id,
      });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "ticket_category_create",
        targetType: "ticket_category",
        targetId: cat.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.status(201).json(cat);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/admin/tickets/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(255).optional(),
        branch: z.string().min(1).max(120).optional(),
        parentId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        descriptionTemplate: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const updated = await storage.updateTicketCategory(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Categoria não encontrada" });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "ticket_category_update",
        targetType: "ticket_category",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/admin/tickets/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.disableTicketCategory(req.params.id);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "ticket_category_disable",
        targetType: "ticket_category",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error disabling category:", error);
      res.status(500).json({ error: "Failed to disable category" });
    }
  });

  app.get("/api/admin/tickets/sla-policies", requireAuth, requireAdmin, async (req, res) => {
    try {
      const policies = await storage.listSlaPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching SLA policies:", error);
      res.status(500).json({ error: "Failed to fetch SLA policies" });
    }
  });

  app.post("/api/admin/tickets/sla-policies", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(120),
        priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
        firstResponseMinutes: z.number().int().positive(),
        resolutionMinutes: z.number().int().positive(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      const policy = await storage.createSlaPolicy(parsed.data);
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating SLA policy:", error);
      res.status(500).json({ error: "Failed to create SLA policy" });
    }
  });

  app.patch("/api/admin/tickets/sla-policies/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(120).optional(),
        priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
        firstResponseMinutes: z.number().int().positive().optional(),
        resolutionMinutes: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const updated = await storage.updateSlaPolicy(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Política SLA não encontrada" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating SLA policy:", error);
      res.status(500).json({ error: "Failed to update SLA policy" });
    }
  });

  // ============ Notification Routes ============

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const items = await storage.listUserNotifications(req.user!.id, { limit, offset });
      res.json(items);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.countUnreadNotifications(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error("Error counting notifications:", error);
      res.status(500).json({ error: "Failed to count notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const ok = await storage.markNotificationRead(req.user!.id, req.params.id);
      if (!ok) return res.status(404).json({ error: "Notificação não encontrada" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  app.get("/api/admin/notifications/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getNotificationSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  app.patch("/api/admin/notifications/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        type: z.enum(["ticket_created", "ticket_comment", "ticket_status", "resource_updated"]),
        enabled: z.boolean(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }
      const setting = await storage.setNotificationSetting(parsed.data.type, parsed.data.enabled);
      res.json(setting);
    } catch (error) {
      console.error("Error updating notification setting:", error);
      res.status(500).json({ error: "Failed to update notification setting" });
    }
  });

  // ============ Knowledge Base Routes (User) ============

  app.get("/api/kb", requireAuth, async (req, res) => {
    try {
      const articles = await storage.listKbArticles({
        categoryId: req.query.categoryId as string | undefined,
        q: req.query.q as string | undefined,
        publishedOnly: true,
      });
      res.json(articles);
    } catch (error) {
      console.error("Error fetching KB articles:", error);
      res.status(500).json({ error: "Failed to fetch KB articles" });
    }
  });

  app.get("/api/kb/:id", requireAuth, async (req, res) => {
    try {
      const article = await storage.getKbArticle(req.params.id);
      if (!article || (!article.isPublished && !req.user!.isAdmin)) {
        return res.status(404).json({ error: "Artigo não encontrado" });
      }
      await storage.logKbArticleView(req.params.id, req.user!.id);
      res.json(article);
    } catch (error) {
      console.error("Error fetching KB article:", error);
      res.status(500).json({ error: "Failed to fetch KB article" });
    }
  });

  app.post("/api/kb/:id/feedback", requireAuth, async (req, res) => {
    try {
      const feedbackSchema = z.object({ helpful: z.boolean() });
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }
      const feedback = await storage.submitKbArticleFeedback(req.params.id, req.user!.id, parsed.data.helpful);
      res.json(feedback);
    } catch (error) {
      console.error("Error submitting KB feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // ============ Knowledge Base Routes (Admin) ============

  app.get("/api/admin/kb", requireAuth, requireAdmin, async (req, res) => {
    try {
      const articles = await storage.listKbArticles({
        categoryId: req.query.categoryId as string | undefined,
        q: req.query.q as string | undefined,
        publishedOnly: false,
      });
      res.json(articles);
    } catch (error) {
      console.error("Error fetching KB articles:", error);
      res.status(500).json({ error: "Failed to fetch KB articles" });
    }
  });

  app.post("/api/admin/kb", requireAuth, requireAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        categoryId: z.string().nullable().optional(),
        isPublished: z.boolean().optional(),
      });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      const article = await storage.createKbArticle({
        ...parsed.data,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "kb_article_create",
        targetType: "kb_article",
        targetId: article.id,
        metadata: { title: article.title },
        ip: req.ip || req.socket.remoteAddress,
      });

      res.status(201).json(article);
    } catch (error) {
      console.error("Error creating KB article:", error);
      res.status(500).json({ error: "Failed to create KB article" });
    }
  });

  app.patch("/api/admin/kb/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const updateSchema = z.object({
        title: z.string().min(1).max(200).optional(),
        body: z.string().min(1).optional(),
        categoryId: z.string().nullable().optional(),
        isPublished: z.boolean().optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      const updated = await storage.updateKbArticle(req.params.id, {
        ...parsed.data,
        updatedBy: req.user!.id,
      });
      if (!updated) return res.status(404).json({ error: "Artigo não encontrado" });

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "kb_article_update",
        targetType: "kb_article",
        targetId: req.params.id,
        metadata: parsed.data,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating KB article:", error);
      res.status(500).json({ error: "Failed to update KB article" });
    }
  });

  app.delete("/api/admin/kb/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteKbArticle(req.params.id);

      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "kb_article_delete",
        targetType: "kb_article",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KB article:", error);
      res.status(500).json({ error: "Failed to delete KB article" });
    }
  });

  // ============ TI Dashboard Route ============

  app.get("/api/admin/ti/dashboard", requireAuth, requireAdmin, async (req, res) => {
    try {
      const range = (req.query.range === '30d' ? '30d' : '7d') as '7d' | '30d';
      const dashboard = await storage.getTiDashboard(range);
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching TI dashboard:", error);
      res.status(500).json({ error: "Failed to fetch TI dashboard" });
    }
  });

  // ============ Typing Test Routes (User) ============

  app.post("/api/typing/session", requireAuth, async (req, res) => {
    try {
      const difficulty = Math.max(1, Math.min(3, parseInt(req.body?.difficulty) || 1));
      const activeTexts = await storage.listTypingTexts(true);
      if (activeTexts.length === 0) {
        return res.status(400).json({ error: "Nenhum texto disponível para digitação" });
      }
      const diffTexts = activeTexts.filter((t: any) => t.difficulty === difficulty);
      const pool = diffTexts.length > 0 ? diffTexts : activeTexts;
      const text = pool[Math.floor(Math.random() * pool.length)];
      const nonce = crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
      const session = await storage.createTypingSession(req.user!.id, text.id, nonce, expiresAt);
      res.json({ session, text, difficulty });
    } catch (error) {
      console.error("Error creating typing session:", error);
      res.status(500).json({ error: "Failed to create typing session" });
    }
  });

  app.post("/api/typing/submit", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        sessionId: z.string().min(1),
        nonce: z.string().min(1),
        wpm: z.number().min(1).max(300),
        accuracy: z.number().min(0).max(100),
        durationMs: z.number().min(1000).max(90000),
        typed: z.string().min(1),
        difficulty: z.number().int().min(1).max(3).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }

      const session = await storage.getTypingSession(parsed.data.sessionId);
      if (!session) return res.status(404).json({ error: "Sessão não encontrada" });
      if (session.userId !== req.user!.id) return res.status(403).json({ error: "Sessão pertence a outro usuário" });
      if (session.submittedAt) return res.status(400).json({ error: "Sessão já foi submetida" });
      if (session.nonce !== parsed.data.nonce) return res.status(400).json({ error: "Nonce inválido" });
      if (new Date() > session.expiresAt) return res.status(400).json({ error: "Sessão expirada" });

      const text = session.textId ? await storage.getTypingText(session.textId) : null;
      if (!text) return res.status(400).json({ error: "Texto original não encontrado" });

      let finalDurationMs = parsed.data.durationMs;
      const durationServerMs = Date.now() - new Date(session.startedAt).getTime();
      if (Math.abs(finalDurationMs - durationServerMs) > 15000) {
        finalDurationMs = durationServerMs;
      }

      if (finalDurationMs < 10000) {
        return res.status(400).json({ error: "Duração muito curta (anti-cheat)" });
      }
      if (finalDurationMs > 90000) {
        finalDurationMs = 90000;
      }

      const durationMin = finalDurationMs / 60000;
      const words = parsed.data.typed.trim().split(/\s+/).length;
      const recalcWpm = Math.round(words / durationMin);
      const finalWpm = Math.min(recalcWpm, 300);

      const userSectorId = req.user!.roles?.[0]?.sectorId || null;
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const difficulty = parsed.data.difficulty || 1;

      const score = await storage.submitTypingSession(parsed.data.sessionId, {
        wpm: finalWpm,
        accuracy: parsed.data.accuracy.toFixed(2),
        durationMs: finalDurationMs,
        userId: req.user!.id,
        sectorId: userSectorId,
        monthKey,
        difficulty,
      });

      res.json(score);
    } catch (error) {
      console.error("Error submitting typing session:", error);
      res.status(500).json({ error: "Failed to submit typing session" });
    }
  });

  app.get("/api/typing/leaderboard", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const monthKey = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const sectorId = req.query.sectorId as string | undefined;
      const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string) : undefined;
      const leaderboard = await storage.getTypingLeaderboard({ monthKey, sectorId, difficulty, limit: 20 });
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/typing/me", requireAuth, async (req, res) => {
    try {
      const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string) : undefined;
      const best = await storage.getUserBestTypingScore(req.user!.id, difficulty);
      res.json(best || null);
    } catch (error) {
      console.error("Error fetching user typing score:", error);
      res.status(500).json({ error: "Failed to fetch user typing score" });
    }
  });

  // ============ Admin Typing Text Routes ============

  app.get("/api/admin/typing/texts", requireAuth, requireAdmin, async (req, res) => {
    try {
      const texts = await storage.listTypingTexts(false);
      res.json(texts);
    } catch (error) {
      console.error("Error fetching typing texts:", error);
      res.status(500).json({ error: "Failed to fetch typing texts" });
    }
  });

  app.post("/api/admin/typing/texts", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        content: z.string().min(10),
        language: z.string().max(10).optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
      }
      const text = await storage.createTypingText(parsed.data as any);
      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "typing_text_create",
        targetType: "typing_text",
        targetId: text.id,
        ip: req.ip || req.socket.remoteAddress,
      });
      res.status(201).json(text);
    } catch (error) {
      console.error("Error creating typing text:", error);
      res.status(500).json({ error: "Failed to create typing text" });
    }
  });

  app.patch("/api/admin/typing/texts/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        content: z.string().min(10).optional(),
        language: z.string().max(10).optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos" });
      }
      const updated = await storage.updateTypingText(req.params.id, parsed.data as any);
      if (!updated) return res.status(404).json({ error: "Texto não encontrado" });
      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "typing_text_update",
        targetType: "typing_text",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating typing text:", error);
      res.status(500).json({ error: "Failed to update typing text" });
    }
  });

  app.delete("/api/admin/typing/texts/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteTypingText(req.params.id);
      await storage.createAuditLog({
        actorUserId: req.user!.id,
        action: "typing_text_delete",
        targetType: "typing_text",
        targetId: req.params.id,
        ip: req.ip || req.socket.remoteAddress,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting typing text:", error);
      res.status(500).json({ error: "Failed to delete typing text" });
    }
  });

  // ============ Admin Reports Routes ============

  function toCsv(headers: string[], rows: Record<string, any>[]): string {
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    }
    return lines.join("\n");
  }

  app.get("/api/admin/reports/tickets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const format = (req.query.format as string) || "json";
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      let whereClause = "";
      const params: any[] = [];
      if (from) {
        params.push(from);
        whereClause += ` AND t.created_at >= $${params.length}::date`;
      }
      if (to) {
        params.push(to);
        whereClause += ` AND t.created_at <= ($${params.length}::date + interval '1 day')`;
      }

      const result = await pool.query(
        `SELECT t.id as "ticketId", t.created_at as "createdAt", t.closed_at as "closedAt",
                t.status, t.priority, t.branch,
                tc.name as "category",
                u.name as "requesterName",
                s.name as "requesterSector"
         FROM tickets t
         LEFT JOIN ticket_categories tc ON t.category_id = tc.id
         LEFT JOIN users u ON t.requester_id = u.id
         LEFT JOIN sectors s ON t.sector_id = s.id
         WHERE 1=1 ${whereClause}
         ORDER BY t.created_at DESC`,
        params
      );

      const rows = result.rows.map((r: any) => ({
        ticketId: r.ticketId,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
        closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : "",
        status: r.status,
        priority: r.priority,
        branch: r.branch || "",
        category: r.category || "",
        requesterName: r.requesterName || "",
        requesterSector: r.requesterSector || "",
      }));

      if (format === "csv") {
        const headers = ["ticketId", "createdAt", "closedAt", "status", "priority", "branch", "category", "requesterName", "requesterSector"];
        const csv = toCsv(headers, rows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="tickets_report.csv"');
        return res.send(csv);
      }
      res.json(rows);
    } catch (error) {
      console.error("Error generating tickets report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/admin/reports/resources", requireAuth, requireAdmin, async (req, res) => {
    try {
      const format = (req.query.format as string) || "json";
      const result = await pool.query(
        `SELECT id as "resourceId", name, type, url, updated_at as "updatedAt"
         FROM resources ORDER BY name`
      );
      const rows = result.rows.map((r: any) => ({
        resourceId: r.resourceId,
        name: r.name,
        type: r.type,
        url: r.url || "",
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : "",
      }));

      if (format === "csv") {
        const headers = ["resourceId", "name", "type", "url", "updatedAt"];
        const csv = toCsv(headers, rows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="resources_report.csv"');
        return res.send(csv);
      }
      res.json(rows);
    } catch (error) {
      console.error("Error generating resources report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/admin/reports/notifications", requireAuth, requireAdmin, async (req, res) => {
    try {
      const format = (req.query.format as string) || "json";
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      let whereClause = "";
      const params: any[] = [];
      if (from) {
        params.push(from);
        whereClause += ` AND n.created_at >= $${params.length}::date`;
      }
      if (to) {
        params.push(to);
        whereClause += ` AND n.created_at <= ($${params.length}::date + interval '1 day')`;
      }

      const result = await pool.query(
        `SELECT n.id, n.type, u.name as "recipientName", n.is_read as "isRead",
                n.created_at as "createdAt", n.link_url as "linkUrl"
         FROM notifications n
         LEFT JOIN users u ON n.user_id = u.id
         WHERE 1=1 ${whereClause}
         ORDER BY n.created_at DESC`,
        params
      );

      const rows = result.rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        recipientName: r.recipientName || "",
        isRead: r.isRead ? "Sim" : "Não",
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
        linkUrl: r.linkUrl || "",
      }));

      if (format === "csv") {
        const headers = ["id", "type", "recipientName", "isRead", "createdAt", "linkUrl"];
        const csv = toCsv(headers, rows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="notifications_report.csv"');
        return res.send(csv);
      }
      res.json(rows);
    } catch (error) {
      console.error("Error generating notifications report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Health check endpoint for backend
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}

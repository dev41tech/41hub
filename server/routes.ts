import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { storage } from "./storage";
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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are allowed"));
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

  // Session middleware
  app.use(
    session({
      secret: sessionSecret || "41hub-dev-only-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict", // CSRF protection via SameSite cookie
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
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

  // Health check endpoint for backend
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}

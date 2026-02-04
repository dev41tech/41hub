import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role_type", ["Admin", "Coordenador", "Usuario"]);
export const resourceTypeEnum = pgEnum("resource_type", ["APP", "DASHBOARD"]);
export const embedModeEnum = pgEnum("embed_mode", ["LINK", "IFRAME", "POWERBI"]);
export const openBehaviorEnum = pgEnum("open_behavior", ["HUB_ONLY", "NEW_TAB_ONLY", "BOTH"]);
export const overrideEffectEnum = pgEnum("override_effect", ["ALLOW", "DENY"]);
export const healthStatusEnum = pgEnum("health_status", ["UP", "DEGRADED", "DOWN"]);
export const authProviderEnum = pgEnum("auth_provider", ["entra", "local"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  entraOid: varchar("entra_oid", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  authProvider: authProviderEnum("auth_provider").notNull().default("entra"),
  passwordHash: varchar("password_hash", { length: 255 }),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordUpdatedAt: timestamp("password_updated_at"),
  themePref: varchar("theme_pref", { length: 10 }).default("light"),
  whatsapp: varchar("whatsapp", { length: 20 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin settings table (for default password, etc.)
export const adminSettings = pgTable("admin_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sectors table
export const sectors = pgTable("sectors", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: roleEnum("name").notNull().unique(),
});

// User-Sector-Roles junction table
export const userSectorRoles = pgTable("user_sector_roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  sectorId: varchar("sector_id", { length: 36 }).notNull().references(() => sectors.id, { onDelete: "cascade" }),
  roleId: varchar("role_id", { length: 36 }).notNull().references(() => roles.id, { onDelete: "cascade" }),
});

// Resources table
export const resources = pgTable("resources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  type: resourceTypeEnum("type").notNull(),
  sectorId: varchar("sector_id", { length: 36 }).references(() => sectors.id, { onDelete: "set null" }),
  icon: varchar("icon", { length: 100 }).default("Layout"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  embedMode: embedModeEnum("embed_mode").notNull().default("LINK"),
  openBehavior: openBehaviorEnum("open_behavior").notNull().default("BOTH"),
  url: text("url"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Resource overrides (allow/deny per user)
export const resourceOverrides = pgTable("resource_overrides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: varchar("resource_id", { length: 36 }).notNull().references(() => resources.id, { onDelete: "cascade" }),
  effect: overrideEffectEnum("effect").notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Favorites
export const favorites = pgTable("favorites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: varchar("resource_id", { length: 36 }).notNull().references(() => resources.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recent access
export const recentAccess = pgTable("recent_access", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: varchar("resource_id", { length: 36 }).notNull().references(() => resources.id, { onDelete: "cascade" }),
  lastAccessAt: timestamp("last_access_at").notNull().defaultNow(),
});

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: varchar("target_id", { length: 36 }),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Health checks
export const healthChecks = pgTable("health_checks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  resourceId: varchar("resource_id", { length: 36 }).notNull().references(() => resources.id, { onDelete: "cascade" }),
  status: healthStatusEnum("status").notNull().default("UP"),
  lastCheckAt: timestamp("last_check_at").notNull().defaultNow(),
  responseTimeMs: integer("response_time_ms"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSectorSchema = createInsertSchema(sectors).omit({
  id: true,
  createdAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
});

export const insertUserSectorRoleSchema = createInsertSchema(userSectorRoles).omit({
  id: true,
});

export const insertResourceOverrideSchema = createInsertSchema(resourceOverrides).omit({
  id: true,
  createdAt: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Sector = typeof sectors.$inferSelect;
export type InsertSector = z.infer<typeof insertSectorSchema>;

export type Role = typeof roles.$inferSelect;

export type UserSectorRole = typeof userSectorRoles.$inferSelect;
export type InsertUserSectorRole = z.infer<typeof insertUserSectorRoleSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type ResourceOverride = typeof resourceOverrides.$inferSelect;
export type InsertResourceOverride = z.infer<typeof insertResourceOverrideSchema>;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;

export type RecentAccess = typeof recentAccess.$inferSelect;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type HealthCheck = typeof healthChecks.$inferSelect;

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;

// Extended types for frontend
export type ResourceWithHealth = Resource & {
  healthStatus?: "UP" | "DEGRADED" | "DOWN";
  sectorName?: string;
  isFavorite?: boolean;
};

export type UserWithRoles = User & {
  roles: Array<{
    sectorId: string;
    sectorName: string;
    roleName: "Admin" | "Coordenador" | "Usuario";
  }>;
  isAdmin: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  photoUrl: string | null;
  roles: Array<{
    sectorId: string;
    sectorName: string;
    roleName: "Admin" | "Coordenador" | "Usuario";
  }>;
};

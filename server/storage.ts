import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  sectors,
  roles,
  userSectorRoles,
  resources,
  resourceOverrides,
  favorites,
  recentAccess,
  auditLogs,
  healthChecks,
  type User,
  type InsertUser,
  type Sector,
  type InsertSector,
  type Role,
  type Resource,
  type InsertResource,
  type UserSectorRole,
  type InsertUserSectorRole,
  type ResourceOverride,
  type InsertResourceOverride,
  type Favorite,
  type InsertFavorite,
  type AuditLog,
  type InsertAuditLog,
  type HealthCheck,
  type UserWithRoles,
  type ResourceWithHealth,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEntraOid(oid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserWithRoles(id: string): Promise<UserWithRoles | undefined>;
  getAllUsersWithRoles(): Promise<UserWithRoles[]>;

  // Sectors
  getSector(id: string): Promise<Sector | undefined>;
  createSector(sector: InsertSector): Promise<Sector>;
  updateSector(id: string, data: Partial<InsertSector>): Promise<Sector | undefined>;
  deleteSector(id: string): Promise<boolean>;
  getAllSectors(): Promise<Sector[]>;

  // Roles
  getRoleByName(name: string): Promise<Role | undefined>;
  getAllRoles(): Promise<Role[]>;

  // User-Sector-Roles
  addUserSectorRole(data: InsertUserSectorRole): Promise<UserSectorRole>;
  removeUserSectorRole(userId: string, sectorId: string): Promise<boolean>;
  getUserSectorRoles(userId: string): Promise<UserSectorRole[]>;

  // Resources
  getResource(id: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: string, data: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: string): Promise<boolean>;
  getAllResources(): Promise<Resource[]>;
  getResourcesForUser(userId: string): Promise<ResourceWithHealth[]>;
  getResourceWithHealth(id: string, userId?: string): Promise<ResourceWithHealth | undefined>;

  // Resource Overrides
  getResourceOverride(userId: string, resourceId: string): Promise<ResourceOverride | undefined>;
  setResourceOverride(data: InsertResourceOverride): Promise<ResourceOverride>;
  removeResourceOverride(userId: string, resourceId: string): Promise<boolean>;
  getResourceOverridesForUser(userId: string): Promise<ResourceOverride[]>;

  // Favorites
  getFavorite(userId: string, resourceId: string): Promise<Favorite | undefined>;
  addFavorite(data: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: string, resourceId: string): Promise<boolean>;
  getUserFavorites(userId: string): Promise<ResourceWithHealth[]>;

  // Recent Access
  recordAccess(userId: string, resourceId: string): Promise<void>;
  getRecentAccess(userId: string, limit?: number): Promise<ResourceWithHealth[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsWithActors(limit?: number): Promise<(AuditLog & { actorName?: string; actorEmail?: string })[]>;

  // Health Checks
  getHealthCheck(resourceId: string): Promise<HealthCheck | undefined>;
  upsertHealthCheck(resourceId: string, status: "UP" | "DEGRADED" | "DOWN", responseTimeMs?: number): Promise<HealthCheck>;

  // Stats
  getAdminStats(): Promise<{ users: number; sectors: number; resources: number; auditLogs: number }>;

  // Team
  getTeamMembers(userId: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    whatsapp: string | null;
    photoUrl: string | null;
    roles: Array<{ sectorId: string; sectorName: string; roleName: "Admin" | "Coordenador" | "Usuario" }>;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEntraOid(oid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.entraOid, oid));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async getUserWithRoles(id: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const userRoles = await db
      .select({
        sectorId: userSectorRoles.sectorId,
        sectorName: sectors.name,
        roleName: roles.name,
      })
      .from(userSectorRoles)
      .innerJoin(sectors, eq(userSectorRoles.sectorId, sectors.id))
      .innerJoin(roles, eq(userSectorRoles.roleId, roles.id))
      .where(eq(userSectorRoles.userId, id));

    const isAdmin = userRoles.some((r) => r.roleName === "Admin");

    return {
      ...user,
      roles: userRoles as Array<{ sectorId: string; sectorName: string; roleName: "Admin" | "Coordenador" | "Usuario" }>,
      isAdmin,
    };
  }

  async getAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const allUsers = await this.getAllUsers();
    const results: UserWithRoles[] = [];

    for (const user of allUsers) {
      const userWithRoles = await this.getUserWithRoles(user.id);
      if (userWithRoles) {
        results.push(userWithRoles);
      }
    }

    return results;
  }

  // Sectors
  async getSector(id: string): Promise<Sector | undefined> {
    const [sector] = await db.select().from(sectors).where(eq(sectors.id, id));
    return sector;
  }

  async createSector(sector: InsertSector): Promise<Sector> {
    const [newSector] = await db.insert(sectors).values(sector).returning();
    return newSector;
  }

  async updateSector(id: string, data: Partial<InsertSector>): Promise<Sector | undefined> {
    const [updated] = await db.update(sectors).set(data).where(eq(sectors.id, id)).returning();
    return updated;
  }

  async deleteSector(id: string): Promise<boolean> {
    const result = await db.delete(sectors).where(eq(sectors.id, id));
    return true;
  }

  async getAllSectors(): Promise<Sector[]> {
    return db.select().from(sectors).orderBy(sectors.name);
  }

  // Roles
  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name as any));
    return role;
  }

  async getAllRoles(): Promise<Role[]> {
    return db.select().from(roles);
  }

  // User-Sector-Roles
  async addUserSectorRole(data: InsertUserSectorRole): Promise<UserSectorRole> {
    const [newRole] = await db.insert(userSectorRoles).values(data).returning();
    return newRole;
  }

  async removeUserSectorRole(userId: string, sectorId: string): Promise<boolean> {
    await db
      .delete(userSectorRoles)
      .where(and(eq(userSectorRoles.userId, userId), eq(userSectorRoles.sectorId, sectorId)));
    return true;
  }

  async getUserSectorRoles(userId: string): Promise<UserSectorRole[]> {
    return db.select().from(userSectorRoles).where(eq(userSectorRoles.userId, userId));
  }

  // Resources
  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  async updateResource(id: string, data: Partial<InsertResource>): Promise<Resource | undefined> {
    const [updated] = await db.update(resources).set(data).where(eq(resources.id, id)).returning();
    return updated;
  }

  async deleteResource(id: string): Promise<boolean> {
    await db.delete(resources).where(eq(resources.id, id));
    return true;
  }

  async getAllResources(): Promise<Resource[]> {
    return db.select().from(resources).orderBy(resources.name);
  }

  async getResourcesForUser(userId: string): Promise<ResourceWithHealth[]> {
    const userWithRoles = await this.getUserWithRoles(userId);
    if (!userWithRoles) return [];

    // If admin, return all active resources
    if (userWithRoles.isAdmin) {
      const allResources = await db
        .select({
          resource: resources,
          sectorName: sectors.name,
          healthStatus: healthChecks.status,
        })
        .from(resources)
        .leftJoin(sectors, eq(resources.sectorId, sectors.id))
        .leftJoin(healthChecks, eq(resources.id, healthChecks.resourceId))
        .where(eq(resources.isActive, true))
        .orderBy(resources.name);

      const userFavorites = await db.select().from(favorites).where(eq(favorites.userId, userId));
      const favoriteIds = new Set(userFavorites.map((f) => f.resourceId));

      return allResources.map((r) => ({
        ...r.resource,
        sectorName: r.sectorName || undefined,
        healthStatus: r.healthStatus as "UP" | "DEGRADED" | "DOWN" | undefined,
        isFavorite: favoriteIds.has(r.resource.id),
      }));
    }

    // Get user's sectors
    const userSectorIds = userWithRoles.roles.map((r) => r.sectorId);
    if (userSectorIds.length === 0) return [];

    // Get resources from user's sectors
    const sectorResources = await db
      .select({
        resource: resources,
        sectorName: sectors.name,
        healthStatus: healthChecks.status,
      })
      .from(resources)
      .leftJoin(sectors, eq(resources.sectorId, sectors.id))
      .leftJoin(healthChecks, eq(resources.id, healthChecks.resourceId))
      .where(and(eq(resources.isActive, true), inArray(resources.sectorId, userSectorIds)))
      .orderBy(resources.name);

    // Get overrides for user
    const overrides = await this.getResourceOverridesForUser(userId);
    const denyOverrides = new Set(overrides.filter((o) => o.effect === "DENY").map((o) => o.resourceId));
    const allowOverrides = new Set(overrides.filter((o) => o.effect === "ALLOW").map((o) => o.resourceId));

    // Get user's favorites
    const userFavorites = await db.select().from(favorites).where(eq(favorites.userId, userId));
    const favoriteIds = new Set(userFavorites.map((f) => f.resourceId));

    // Filter resources based on overrides (DENY takes precedence)
    const filteredResources = sectorResources.filter((r) => {
      if (denyOverrides.has(r.resource.id)) return false;
      return true;
    });

    return filteredResources.map((r) => ({
      ...r.resource,
      sectorName: r.sectorName || undefined,
      healthStatus: r.healthStatus as "UP" | "DEGRADED" | "DOWN" | undefined,
      isFavorite: favoriteIds.has(r.resource.id),
    }));
  }

  async getResourceWithHealth(id: string, userId?: string): Promise<ResourceWithHealth | undefined> {
    const [result] = await db
      .select({
        resource: resources,
        sectorName: sectors.name,
        healthStatus: healthChecks.status,
      })
      .from(resources)
      .leftJoin(sectors, eq(resources.sectorId, sectors.id))
      .leftJoin(healthChecks, eq(resources.id, healthChecks.resourceId))
      .where(eq(resources.id, id));

    if (!result) return undefined;

    let isFavorite = false;
    if (userId) {
      const fav = await this.getFavorite(userId, id);
      isFavorite = !!fav;
    }

    return {
      ...result.resource,
      sectorName: result.sectorName || undefined,
      healthStatus: result.healthStatus as "UP" | "DEGRADED" | "DOWN" | undefined,
      isFavorite,
    };
  }

  // Resource Overrides
  async getResourceOverride(userId: string, resourceId: string): Promise<ResourceOverride | undefined> {
    const [override] = await db
      .select()
      .from(resourceOverrides)
      .where(and(eq(resourceOverrides.userId, userId), eq(resourceOverrides.resourceId, resourceId)));
    return override;
  }

  async setResourceOverride(data: InsertResourceOverride): Promise<ResourceOverride> {
    // Delete existing override if any
    await db
      .delete(resourceOverrides)
      .where(and(eq(resourceOverrides.userId, data.userId), eq(resourceOverrides.resourceId, data.resourceId)));

    const [newOverride] = await db.insert(resourceOverrides).values(data).returning();
    return newOverride;
  }

  async removeResourceOverride(userId: string, resourceId: string): Promise<boolean> {
    await db
      .delete(resourceOverrides)
      .where(and(eq(resourceOverrides.userId, userId), eq(resourceOverrides.resourceId, resourceId)));
    return true;
  }

  async getResourceOverridesForUser(userId: string): Promise<ResourceOverride[]> {
    return db.select().from(resourceOverrides).where(eq(resourceOverrides.userId, userId));
  }

  // Favorites
  async getFavorite(userId: string, resourceId: string): Promise<Favorite | undefined> {
    const [fav] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.resourceId, resourceId)));
    return fav;
  }

  async addFavorite(data: InsertFavorite): Promise<Favorite> {
    // Check if already exists
    const existing = await this.getFavorite(data.userId, data.resourceId);
    if (existing) return existing;

    const [newFav] = await db.insert(favorites).values(data).returning();
    return newFav;
  }

  async removeFavorite(userId: string, resourceId: string): Promise<boolean> {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.resourceId, resourceId)));
    return true;
  }

  async getUserFavorites(userId: string): Promise<ResourceWithHealth[]> {
    const favs = await db
      .select({
        resource: resources,
        sectorName: sectors.name,
        healthStatus: healthChecks.status,
      })
      .from(favorites)
      .innerJoin(resources, eq(favorites.resourceId, resources.id))
      .leftJoin(sectors, eq(resources.sectorId, sectors.id))
      .leftJoin(healthChecks, eq(resources.id, healthChecks.resourceId))
      .where(and(eq(favorites.userId, userId), eq(resources.isActive, true)))
      .orderBy(favorites.sortOrder);

    return favs.map((f) => ({
      ...f.resource,
      sectorName: f.sectorName || undefined,
      healthStatus: f.healthStatus as "UP" | "DEGRADED" | "DOWN" | undefined,
      isFavorite: true,
    }));
  }

  // Recent Access
  async recordAccess(userId: string, resourceId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(recentAccess)
      .where(and(eq(recentAccess.userId, userId), eq(recentAccess.resourceId, resourceId)));

    if (existing) {
      await db
        .update(recentAccess)
        .set({ lastAccessAt: new Date() })
        .where(eq(recentAccess.id, existing.id));
    } else {
      await db.insert(recentAccess).values({ userId, resourceId });
    }
  }

  async getRecentAccess(userId: string, limit: number = 5): Promise<ResourceWithHealth[]> {
    const recent = await db
      .select({
        resource: resources,
        sectorName: sectors.name,
        healthStatus: healthChecks.status,
      })
      .from(recentAccess)
      .innerJoin(resources, eq(recentAccess.resourceId, resources.id))
      .leftJoin(sectors, eq(resources.sectorId, sectors.id))
      .leftJoin(healthChecks, eq(resources.id, healthChecks.resourceId))
      .where(and(eq(recentAccess.userId, userId), eq(resources.isActive, true)))
      .orderBy(desc(recentAccess.lastAccessAt))
      .limit(limit);

    const userFavorites = await db.select().from(favorites).where(eq(favorites.userId, userId));
    const favoriteIds = new Set(userFavorites.map((f) => f.resourceId));

    return recent.map((r) => ({
      ...r.resource,
      sectorName: r.sectorName || undefined,
      healthStatus: r.healthStatus as "UP" | "DEGRADED" | "DOWN" | undefined,
      isFavorite: favoriteIds.has(r.resource.id),
    }));
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getAuditLogsWithActors(limit: number = 100): Promise<(AuditLog & { actorName?: string; actorEmail?: string })[]> {
    const logs = await db
      .select({
        log: auditLogs,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return logs.map((l) => ({
      ...l.log,
      actorName: l.actorName || undefined,
      actorEmail: l.actorEmail || undefined,
    }));
  }

  // Health Checks
  async getHealthCheck(resourceId: string): Promise<HealthCheck | undefined> {
    const [check] = await db.select().from(healthChecks).where(eq(healthChecks.resourceId, resourceId));
    return check;
  }

  async upsertHealthCheck(
    resourceId: string,
    status: "UP" | "DEGRADED" | "DOWN",
    responseTimeMs?: number
  ): Promise<HealthCheck> {
    const existing = await this.getHealthCheck(resourceId);

    if (existing) {
      const [updated] = await db
        .update(healthChecks)
        .set({ status, responseTimeMs, lastCheckAt: new Date() })
        .where(eq(healthChecks.resourceId, resourceId))
        .returning();
      return updated;
    }

    const [newCheck] = await db
      .insert(healthChecks)
      .values({ resourceId, status, responseTimeMs })
      .returning();
    return newCheck;
  }

  // Stats
  async getAdminStats(): Promise<{ users: number; sectors: number; resources: number; auditLogs: number }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [sectorCount] = await db.select({ count: sql<number>`count(*)` }).from(sectors);
    const [resourceCount] = await db.select({ count: sql<number>`count(*)` }).from(resources);
    const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);

    return {
      users: Number(userCount.count),
      sectors: Number(sectorCount.count),
      resources: Number(resourceCount.count),
      auditLogs: Number(logCount.count),
    };
  }

  // Team
  async getTeamMembers(userId: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    whatsapp: string | null;
    photoUrl: string | null;
    roles: Array<{ sectorId: string; sectorName: string; roleName: "Admin" | "Coordenador" | "Usuario" }>;
  }>> {
    // Get the user's sectors
    const userSectorIds = await db
      .select({ sectorId: userSectorRoles.sectorId })
      .from(userSectorRoles)
      .where(eq(userSectorRoles.userId, userId));

    if (userSectorIds.length === 0) {
      return [];
    }

    const sectorIds = userSectorIds.map(s => s.sectorId);

    // Get all users in those sectors (excluding the current user)
    const teammateIds = await db
      .selectDistinct({ userId: userSectorRoles.userId })
      .from(userSectorRoles)
      .where(
        and(
          inArray(userSectorRoles.sectorId, sectorIds),
          sql`${userSectorRoles.userId} != ${userId}`
        )
      );

    if (teammateIds.length === 0) {
      return [];
    }

    const teammates: Array<{
      id: string;
      name: string;
      email: string;
      whatsapp: string | null;
      photoUrl: string | null;
      roles: Array<{ sectorId: string; sectorName: string; roleName: "Admin" | "Coordenador" | "Usuario" }>;
    }> = [];

    for (const { userId: tId } of teammateIds) {
      const [user] = await db.select().from(users).where(eq(users.id, tId));
      if (!user || !user.isActive) continue;

      const userRoles = await db
        .select({
          sectorId: userSectorRoles.sectorId,
          sectorName: sectors.name,
          roleName: roles.name,
        })
        .from(userSectorRoles)
        .innerJoin(sectors, eq(userSectorRoles.sectorId, sectors.id))
        .innerJoin(roles, eq(userSectorRoles.roleId, roles.id))
        .where(eq(userSectorRoles.userId, tId));

      teammates.push({
        id: user.id,
        name: user.name,
        email: user.email,
        whatsapp: user.whatsapp,
        photoUrl: user.photoUrl,
        roles: userRoles as Array<{ sectorId: string; sectorName: string; roleName: "Admin" | "Coordenador" | "Usuario" }>,
      });
    }

    return teammates.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const storage = new DatabaseStorage();

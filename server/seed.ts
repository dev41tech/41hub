import { db } from "./db";
import { users, sectors, roles, userSectorRoles, resources, healthChecks, ticketSlaPolicies, ticketCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seed() {
  console.log("Seeding database...");

  try {
    // Check if already seeded
    const existingSectors = await db.select().from(sectors);
    if (existingSectors.length > 0) {
      console.log("Database already seeded, skipping...");
      await ensureTicketDefaults();
      return;
    }

    // Create roles
    console.log("Creating roles...");
    const [adminRole] = await db.insert(roles).values({ name: "Admin" }).returning();
    const [coordRole] = await db.insert(roles).values({ name: "Coordenador" }).returning();
    const [userRole] = await db.insert(roles).values({ name: "Usuario" }).returning();

    // Create sectors
    console.log("Creating sectors...");
    const [sectorBPO] = await db.insert(sectors).values({ name: "BPO" }).returning();
    const [sectorDP] = await db.insert(sectors).values({ name: "DP" }).returning();
    const [sectorContabil] = await db.insert(sectors).values({ name: "Contábil" }).returning();
    const [sectorTech] = await db.insert(sectors).values({ name: "Tech" }).returning();

    // Create admin user
    console.log("Creating admin user...");
    const adminEmail = process.env.ENTRA_ADMIN_EMAIL || "admin@41tech.com.br";
    const [adminUser] = await db
      .insert(users)
      .values({
        email: adminEmail,
        name: "Administrador 41 Tech",
        isActive: true,
        themePref: "light",
      })
      .returning();

    // Assign admin role (global admin via Tech sector)
    await db.insert(userSectorRoles).values({
      userId: adminUser.id,
      sectorId: sectorTech.id,
      roleId: adminRole.id,
    });

    // Create sample users
    console.log("Creating sample users...");
    const [userMaria] = await db
      .insert(users)
      .values({
        email: "maria.santos@41tech.com.br",
        name: "Maria Santos",
        isActive: true,
        themePref: "light",
      })
      .returning();

    await db.insert(userSectorRoles).values({
      userId: userMaria.id,
      sectorId: sectorBPO.id,
      roleId: coordRole.id,
    });

    const [userJoao] = await db
      .insert(users)
      .values({
        email: "joao.silva@41tech.com.br",
        name: "João Silva",
        isActive: true,
        themePref: "dark",
      })
      .returning();

    await db.insert(userSectorRoles).values({
      userId: userJoao.id,
      sectorId: sectorDP.id,
      roleId: userRole.id,
    });

    const [userAna] = await db
      .insert(users)
      .values({
        email: "ana.oliveira@41tech.com.br",
        name: "Ana Oliveira",
        isActive: true,
        themePref: "light",
      })
      .returning();

    await db.insert(userSectorRoles).values({
      userId: userAna.id,
      sectorId: sectorContabil.id,
      roleId: coordRole.id,
    });

    // Create sample resources - Apps
    console.log("Creating sample resources...");
    
    // BPO Apps
    const [appCRM] = await db
      .insert(resources)
      .values({
        name: "Sistema CRM",
        type: "APP",
        sectorId: sectorBPO.id,
        icon: "Users",
        tags: ["crm", "clientes", "vendas"],
        embedMode: "IFRAME",
        url: "https://crm.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appCRM.id, status: "UP" });

    const [appTickets] = await db
      .insert(resources)
      .values({
        name: "Central de Tickets",
        type: "APP",
        sectorId: sectorBPO.id,
        icon: "Ticket",
        tags: ["suporte", "tickets", "atendimento"],
        embedMode: "LINK",
        url: "https://tickets.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appTickets.id, status: "UP" });

    // DP Apps
    const [appFolha] = await db
      .insert(resources)
      .values({
        name: "Sistema de Folha",
        type: "APP",
        sectorId: sectorDP.id,
        icon: "FileSpreadsheet",
        tags: ["folha", "pagamento", "rh"],
        embedMode: "IFRAME",
        url: "https://folha.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appFolha.id, status: "UP" });

    const [appPonto] = await db
      .insert(resources)
      .values({
        name: "Controle de Ponto",
        type: "APP",
        sectorId: sectorDP.id,
        icon: "Clock",
        tags: ["ponto", "frequência", "horas"],
        embedMode: "LINK",
        url: "https://ponto.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appPonto.id, status: "DEGRADED" });

    // Contábil Apps
    const [appFiscal] = await db
      .insert(resources)
      .values({
        name: "Sistema Fiscal",
        type: "APP",
        sectorId: sectorContabil.id,
        icon: "FileText",
        tags: ["fiscal", "notas", "impostos"],
        embedMode: "IFRAME",
        url: "https://fiscal.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appFiscal.id, status: "UP" });

    const [appContabil] = await db
      .insert(resources)
      .values({
        name: "Contabilidade",
        type: "APP",
        sectorId: sectorContabil.id,
        icon: "Calculator",
        tags: ["contábil", "balanço", "demonstrativos"],
        embedMode: "LINK",
        url: "https://contabil.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appContabil.id, status: "UP" });

    // Tech Apps
    const [appDevOps] = await db
      .insert(resources)
      .values({
        name: "Portal DevOps",
        type: "APP",
        sectorId: sectorTech.id,
        icon: "Code",
        tags: ["devops", "ci/cd", "infraestrutura"],
        embedMode: "LINK",
        url: "https://devops.41tech.com.br",
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: appDevOps.id, status: "UP" });

    // Dashboards
    const [dashBPO] = await db
      .insert(resources)
      .values({
        name: "Dashboard BPO",
        type: "DASHBOARD",
        sectorId: sectorBPO.id,
        icon: "BarChart3",
        tags: ["dashboard", "kpi", "bpo"],
        embedMode: "POWERBI",
        url: "https://app.powerbi.com/groups/xxx/reports/yyy",
        metadata: { workspaceId: "xxx", reportId: "yyy" },
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: dashBPO.id, status: "UP" });

    const [dashDP] = await db
      .insert(resources)
      .values({
        name: "Indicadores DP",
        type: "DASHBOARD",
        sectorId: sectorDP.id,
        icon: "PieChart",
        tags: ["dashboard", "rh", "indicadores"],
        embedMode: "POWERBI",
        url: "https://app.powerbi.com/groups/xxx/reports/zzz",
        metadata: { workspaceId: "xxx", reportId: "zzz" },
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: dashDP.id, status: "UP" });

    const [dashFinanceiro] = await db
      .insert(resources)
      .values({
        name: "Dashboard Financeiro",
        type: "DASHBOARD",
        sectorId: sectorContabil.id,
        icon: "TrendingUp",
        tags: ["dashboard", "financeiro", "resultados"],
        embedMode: "POWERBI",
        url: "https://app.powerbi.com/groups/xxx/reports/www",
        metadata: { workspaceId: "xxx", reportId: "www" },
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: dashFinanceiro.id, status: "UP" });

    const [dashExecutivo] = await db
      .insert(resources)
      .values({
        name: "Visão Executiva",
        type: "DASHBOARD",
        sectorId: sectorTech.id,
        icon: "Target",
        tags: ["dashboard", "executivo", "geral"],
        embedMode: "POWERBI",
        url: "https://app.powerbi.com/groups/xxx/reports/vvv",
        metadata: { workspaceId: "xxx", reportId: "vvv" },
        isActive: true,
      })
      .returning();
    await db.insert(healthChecks).values({ resourceId: dashExecutivo.id, status: "UP" });

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }

  await ensureTicketDefaults();
}

async function ensureTicketDefaults() {
  try {
    const defaultPolicies = [
      { name: "SLA Urgente", priority: "URGENTE" as const, firstResponseMinutes: 60, resolutionMinutes: 480 },
      { name: "SLA Alta", priority: "ALTA" as const, firstResponseMinutes: 240, resolutionMinutes: 1440 },
      { name: "SLA Média", priority: "MEDIA" as const, firstResponseMinutes: 480, resolutionMinutes: 4320 },
      { name: "SLA Baixa", priority: "BAIXA" as const, firstResponseMinutes: 1440, resolutionMinutes: 10080 },
    ];

    for (const policy of defaultPolicies) {
      const [existing] = await db.select().from(ticketSlaPolicies).where(eq(ticketSlaPolicies.name, policy.name));
      if (!existing) {
        await db.insert(ticketSlaPolicies).values(policy);
        console.log(`Created SLA policy: ${policy.name}`);
      }
    }

    const branches = ["INFRA", "DEV", "SUPORTE"] as const;
    for (const branch of branches) {
      const [existing] = await db.select().from(ticketCategories)
        .where(eq(ticketCategories.name, branch));
      if (!existing) {
        await db.insert(ticketCategories).values({
          name: branch,
          branch,
          parentId: null,
          isActive: true,
        });
        console.log(`Created ticket category root: ${branch}`);
      }
    }
  } catch (error) {
    console.error("Error ensuring ticket defaults:", error);
  }
}

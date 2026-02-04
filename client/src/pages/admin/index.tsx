import { Link } from "wouter";
import {
  Users,
  Building2,
  Layout,
  FileText,
  ChevronRight,
  Shield,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  users: number;
  sectors: number;
  resources: number;
  auditLogs: number;
}

interface AuditLogWithActor {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, any>;
  ip: string | null;
  createdAt: string;
  actorName?: string;
  actorEmail?: string;
}

const adminSections = [
  {
    title: "Setores",
    description: "Gerenciar setores da organização",
    icon: Building2,
    href: "/admin/sectors",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Usuários",
    description: "Gerenciar usuários e permissões",
    icon: Users,
    href: "/admin/users",
    color: "bg-chart-2/10 text-chart-2",
  },
  {
    title: "Recursos",
    description: "Gerenciar apps e dashboards",
    icon: Layout,
    href: "/admin/resources",
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    title: "Auditoria",
    description: "Visualizar logs de atividades",
    icon: FileText,
    href: "/admin/audit",
    color: "bg-chart-4/10 text-chart-4",
  },
];

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    user_login: "Login",
    user_logout: "Logout",
    user_create: "Criou usuário",
    user_update: "Atualizou usuário",
    user_update_profile: "Atualizou perfil",
    user_update_theme: "Alterou tema",
    user_upload_photo: "Enviou foto",
    sector_create: "Criou setor",
    sector_update: "Atualizou setor",
    sector_delete: "Excluiu setor",
    resource_create: "Criou recurso",
    resource_update: "Atualizou recurso",
    resource_delete: "Excluiu recurso",
    resource_access: "Acessou recurso",
    favorite_add: "Adicionou favorito",
    favorite_remove: "Removeu favorito",
  };
  return actionMap[action] || action;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export default function AdminIndex() {
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentLogs = [] } = useQuery<AuditLogWithActor[]>({
    queryKey: ["/api/admin/audit", "recent"],
    queryFn: async () => {
      const response = await fetch("/api/admin/audit?limit=10", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administração</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie setores, usuários e recursos do Hub
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.sectors || 0}</p>
              <p className="text-sm text-muted-foreground">Setores</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Users className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.users || 0}</p>
              <p className="text-sm text-muted-foreground">Usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
              <Layout className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.resources || 0}</p>
              <p className="text-sm text-muted-foreground">Recursos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <FileText className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.auditLogs || 0}</p>
              <p className="text-sm text-muted-foreground">Logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover-elevate cursor-pointer h-full" data-testid={`admin-section-${section.title.toLowerCase()}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${section.color}`}>
                  <section.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {section.description}
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Atividade Recente
          </CardTitle>
          <Link href="/admin/audit">
            <Badge variant="outline" className="cursor-pointer hover-elevate">
              Ver todos
              <ChevronRight className="h-3 w-3 ml-1" />
            </Badge>
          </Link>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atividade registrada
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                  data-testid={`log-${log.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {log.actorName || log.actorEmail || "Sistema"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatAction(log.action)}
                      {log.targetType && ` • ${log.targetType}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

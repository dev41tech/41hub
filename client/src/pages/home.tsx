import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LayoutGrid,
  BarChart3,
  Ticket,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentAccessSection } from "@/components/recent-access-section";
import { ResourceCard } from "@/components/resource-card";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ResourceWithHealth } from "@shared/schema";

interface TicketStats {
  open: string;
  resolved: string;
  total: string;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isRead: boolean;
  createdAt: string;
}

const severityBadge: Record<string, "default" | "secondary" | "destructive"> = {
  info: "secondary",
  warning: "default",
  critical: "destructive",
};

const severityLabel: Record<string, string> = {
  info: "Informação",
  warning: "Atenção",
  critical: "Crítico",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources"],
  });

  const { data: recentResources = [], isLoading: recentLoading } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources/recent"],
  });

  const { data: ticketStats } = useQuery<{ tickets: TicketStats }>({
    queryKey: ["/api/admin/analytics/stats"],
    enabled: user?.isAdmin === true,
  });

  const { data: alertsRaw } = useQuery<AlertItem[] | { error: string }>({
    queryKey: ["/api/alerts?active=true"],
    queryFn: () =>
      fetch("/api/alerts?active=true", { credentials: "include" }).then((r) => r.json()),
    retry: false,
  });
  const alerts: AlertItem[] = Array.isArray(alertsRaw) ? alertsRaw : [];

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ resourceId, isFavorite }: { resourceId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return apiRequest("POST", `/api/favorites/${resourceId}`);
      } else {
        return apiRequest("DELETE", `/api/favorites/${resourceId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const safeResources = Array.isArray(resources) ? resources : [];
  const favoriteResources = safeResources.filter((r) => r.isFavorite);
  const resourcesDown = safeResources.filter((r) => r.healthStatus === "DOWN").length;
  const resourcesDegraded = safeResources.filter((r) => r.healthStatus === "DEGRADED").length;
  const activeAlerts = alerts.filter((a) => !a.isRead);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");

  const handleOpenResource = (resource: ResourceWithHealth) => {
    setLocation(`/resource/${resource.id}`);
  };

  const handleToggleFavorite = (resourceId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ resourceId, isFavorite });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {user?.name?.split(" ")[0] || "Usuário"}
        </h1>
        <p className="text-muted-foreground">Bem-vindo ao portal corporativo 41 Tech</p>
      </div>

      {/* Critical alerts banner */}
      {criticalAlerts.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 cursor-pointer"
          onClick={() => setLocation("/alerts")}
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive">
              {criticalAlerts.length} alerta{criticalAlerts.length !== 1 ? "s" : ""} crítico
              {criticalAlerts.length !== 1 ? "s" : ""} ativo
              {criticalAlerts.length !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {criticalAlerts[0].title}
            </p>
          </div>
          <Badge variant="destructive" className="shrink-0">Ver alertas</Badge>
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => setLocation("/apps")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-semibold">
                {safeResources.filter((r) => r.type === "APP").length}
              </p>
              <p className="text-xs text-muted-foreground">Aplicações</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => setLocation("/dashboards")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 shrink-0">
              <BarChart3 className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-xl font-semibold">
                {safeResources.filter((r) => r.type === "DASHBOARD").length}
              </p>
              <p className="text-xs text-muted-foreground">Dashboards</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => setLocation("/alerts")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-semibold">{activeAlerts.length}</p>
              <p className="text-xs text-muted-foreground">Alertas ativos</p>
            </div>
          </CardContent>
        </Card>

        {resourcesDown + resourcesDegraded > 0 ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{resourcesDown + resourcesDegraded}</p>
                <p className="text-xs text-muted-foreground">Recursos c/ problema</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{safeResources.length}</p>
                <p className="text-xs text-muted-foreground">Recursos OK</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin ticket stats */}
      {user?.isAdmin && ticketStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/tickets")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                <Ticket className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{ticketStats.tickets?.open ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Chamados abertos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/tickets")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{ticketStats.tickets?.resolved ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/tickets")}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 shrink-0">
                <Clock className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{ticketStats.tickets?.total ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Total de chamados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active alerts list */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alertas recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setLocation("/alerts")}
              >
                <Badge variant={severityBadge[alert.severity] ?? "secondary"} className="shrink-0 mt-0.5 text-xs">
                  {severityLabel[alert.severity] ?? alert.severity}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{alert.message}</p>
                </div>
              </div>
            ))}
            {activeAlerts.length > 3 && (
              <p
                className="text-xs text-muted-foreground text-center cursor-pointer hover:underline"
                onClick={() => setLocation("/alerts")}
              >
                Ver mais {activeAlerts.length - 3} alertas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Favoritos */}
      {favoriteResources.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            Favoritos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onOpen={handleOpenResource}
                onToggleFavorite={handleToggleFavorite}
                isAdmin={user?.isAdmin === true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Acessados recentemente */}
      <RecentAccessSection
        resources={recentResources}
        isLoading={recentLoading}
        onOpen={handleOpenResource}
      />
    </div>
  );
}

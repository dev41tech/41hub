import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isActive: boolean;
  createdAt: string;
  createdByName: string | null;
  isRead?: boolean;
}

const severityConfig = {
  info: {
    label: "Informação",
    variant: "secondary" as const,
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  warning: {
    label: "Atenção",
    variant: "default" as const,
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  critical: {
    label: "Crítico",
    variant: "destructive" as const,
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}

export default function Alerts() {
  const { toast } = useToast();

  const { data: alertsRaw, isLoading } = useQuery<AlertItem[] | unknown>({
    queryKey: ["/api/alerts"],
    queryFn: () =>
      fetch("/api/alerts?active=true", { credentials: "include" }).then((r) => r.json()),
    retry: false,
  });
  const alerts: AlertItem[] = Array.isArray(alertsRaw) ? alertsRaw : [];

  const readMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alerts/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Alerta marcado como lido" });
    },
    onError: () => toast({ title: "Erro ao marcar alerta", variant: "destructive" }),
  });

  return (
    <PageContainer className="flex flex-col gap-6 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <Bell className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Alertas</h1>
          <p className="text-sm text-muted-foreground">Avisos e comunicados do sistema</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-medium">Nenhum alerta ativo</p>
            <p className="text-sm text-muted-foreground">Tudo em ordem!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const cfg = severityConfig[alert.severity] ?? severityConfig.info;
            const SevIcon = cfg.icon;
            return (
              <Card key={alert.id} className={alert.isRead ? "opacity-60" : ""}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${cfg.bg}`}
                  >
                    <SevIcon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={cfg.variant} className="text-xs">
                        {cfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(alert.createdAt)}
                      </span>
                      {alert.createdByName && (
                        <span className="text-xs text-muted-foreground">
                          por {alert.createdByName}
                        </span>
                      )}
                    </div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  {!alert.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={readMutation.isPending}
                      onClick={() => readMutation.mutate(alert.id)}
                    >
                      {readMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Marcar lido
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

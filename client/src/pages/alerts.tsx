import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Info,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
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
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AlertItem | null>(null);
  const [form, setForm] = useState({
    title: "",
    message: "",
    severity: "info" as "info" | "warning" | "critical",
    isActive: true,
  });

  // User query (active alerts)
  const { data: userAlertsRaw, isLoading: userLoading } = useQuery<AlertItem[] | unknown>({
    queryKey: ["/api/alerts"],
    queryFn: () =>
      fetch("/api/alerts?active=true", { credentials: "include" }).then((r) => r.json()),
    retry: false,
  });
  const userAlerts: AlertItem[] = Array.isArray(userAlertsRaw) ? userAlertsRaw : [];

  // Admin query (all alerts)
  const { data: adminAlertsRaw, isLoading: adminLoading } = useQuery<AlertItem[] | unknown>({
    queryKey: ["/api/admin/alerts"],
    enabled: isAdmin === true,
    retry: false,
  });
  const adminAlerts: AlertItem[] = Array.isArray(adminAlertsRaw) ? adminAlertsRaw : [];

  const readMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alerts/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/admin/alerts", data),
    onSuccess: () => {
      toast({ title: "Alerta criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao criar alerta", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) =>
      apiRequest("PATCH", `/api/admin/alerts/${id}`, data),
    onSuccess: () => {
      toast({ title: "Alerta atualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao atualizar alerta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/alerts/${id}`),
    onSuccess: () => {
      toast({ title: "Alerta removido" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
    onError: () => toast({ title: "Erro ao remover alerta", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", message: "", severity: "info", isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (alert: AlertItem) => {
    setEditing(alert);
    setForm({
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      isActive: alert.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleActive = (alert: AlertItem) => {
    updateMutation.mutate({ id: alert.id, data: { isActive: !alert.isActive } });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Bell className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Alertas / Avisos</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Gerencie e publique alertas do sistema" : "Avisos e comunicados do sistema"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo alerta
          </Button>
        )}
      </div>

      {isAdmin ? (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            <AdminAlertList
              alerts={adminAlerts.filter((a) => a.isActive)}
              loading={adminLoading}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onToggle={toggleActive}
            />
          </TabsContent>

          <TabsContent value="all" className="space-y-3 mt-4">
            <AdminAlertList
              alerts={adminAlerts}
              loading={adminLoading}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onToggle={toggleActive}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-3">
          {userLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : userAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-medium">Nenhum alerta ativo</p>
                <p className="text-sm text-muted-foreground">
                  Tudo em ordem por aqui!
                </p>
              </CardContent>
            </Card>
          ) : (
            userAlerts.map((alert) => {
              const cfg = severityConfig[alert.severity] ?? severityConfig.info;
              const SevIcon = cfg.icon;
              return (
                <Card
                  key={alert.id}
                  className={alert.isRead ? "opacity-60" : ""}
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${cfg.bg}`}
                    >
                      <SevIcon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
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
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.message}
                      </p>
                    </div>
                    {!alert.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => readMutation.mutate(alert.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar lido
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar alerta" : "Novo alerta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Manutenção programada"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Descreva o alerta com detalhes..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Severidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, severity: v as "info" | "warning" | "critical" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informação</SelectItem>
                    <SelectItem value="warning">Atenção</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  />
                  <span className="text-sm">
                    {form.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminAlertList({
  alerts,
  loading,
  onEdit,
  onDelete,
  onToggle,
}: {
  alerts: AlertItem[];
  loading: boolean;
  onEdit: (a: AlertItem) => void;
  onDelete: (id: string) => void;
  onToggle: (a: AlertItem) => void;
}) {
  if (loading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum alerta encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity] ?? severityConfig.info;
        const SevIcon = cfg.icon;
        return (
          <Card key={alert.id} className={!alert.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${cfg.bg}`}
                >
                  <SevIcon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-medium truncate">
                    {alert.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={cfg.variant} className="text-xs">
                      {cfg.label}
                    </Badge>
                    {!alert.isActive && (
                      <Badge variant="outline" className="text-xs">
                        Inativo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={alert.isActive ? "Desativar" : "Ativar"}
                  onClick={() => onToggle(alert)}
                >
                  {alert.isActive ? (
                    <PowerOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Power className="h-4 w-4 text-green-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(alert)}
                >
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(alert.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pl-12">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {alert.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(alert.createdAt))}
                {alert.createdByName && ` · por ${alert.createdByName}`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

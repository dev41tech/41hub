import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Ticket,
  Users,
  Activity,
  BarChart2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Keyboard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { AuditLog } from "@shared/schema";

interface AnalyticsStats {
  tickets: {
    total: string;
    open: string;
    resolved: string;
    cancelled: string;
  };
  byStatus: Array<{ status: string; count: string }>;
  byPriority: Array<{ priority: string; count: string }>;
  topCategories: Array<{ category: string | null; count: string }>;
  resources: {
    total: string;
    up: string;
    degraded: string;
    down: string;
  };
  typing: {
    totalSessions: string;
    avgWpm: string | null;
    avgAccuracy: string | null;
  };
}

interface AuditLogWithActor extends AuditLog {
  actorName?: string;
  actorEmail?: string;
}

const statusLabels: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_USUARIO: "Aguardando usuário",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  RESOLVIDO: "Resolvido",
  CANCELADO: "Cancelado",
};

const priorityLabels: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const statusColors: Record<string, string> = {
  ABERTO: "bg-blue-500",
  EM_ANDAMENTO: "bg-amber-500",
  AGUARDANDO_USUARIO: "bg-purple-500",
  AGUARDANDO_APROVACAO: "bg-orange-500",
  RESOLVIDO: "bg-green-500",
  CANCELADO: "bg-red-500",
};

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number | null | undefined;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${color}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value ?? "—"}</p>
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  const statsUrl = `/api/admin/analytics/stats${from || to ? `?${from ? `from=${from}` : ""}${from && to ? "&" : ""}${to ? `to=${to}` : ""}` : ""}`;

  const { data: stats, isLoading: statsLoading } = useQuery<AnalyticsStats>({
    queryKey: [statsUrl],
    queryFn: () => fetch(statsUrl, { credentials: "include" }).then((r) => r.json()),
  });

  const auditUrl = `/api/admin/audit?limit=50&page=${auditPage}${auditFrom ? `&from=${auditFrom}` : ""}${auditTo ? `&to=${auditTo}` : ""}`;
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLogWithActor[]>({
    queryKey: [auditUrl],
    queryFn: () => fetch(auditUrl, { credentials: "include" }).then((r) => r.json()),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
          <LineChart className="h-5 w-5 text-chart-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Métricas, logs e painel de TI do portal
          </p>
        </div>
      </div>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">
            <BarChart2 className="h-4 w-4 mr-2" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Activity className="h-4 w-4 mr-2" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* ===== METRICS TAB ===== */}
        <TabsContent value="metrics" className="space-y-6 mt-4">
          {/* Date filter */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-40"
                />
              </div>
              {(from || to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Limpar filtro
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Ticket metrics */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Chamados
            </h2>
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total"
                  value={stats?.tickets.total}
                  icon={Ticket}
                  color="bg-primary/10 text-primary"
                />
                <MetricCard
                  title="Abertos"
                  value={stats?.tickets.open}
                  icon={Clock}
                  color="bg-blue-500/10 text-blue-500"
                />
                <MetricCard
                  title="Resolvidos"
                  value={stats?.tickets.resolved}
                  icon={CheckCircle2}
                  color="bg-green-500/10 text-green-500"
                />
                <MetricCard
                  title="Cancelados"
                  value={stats?.tickets.cancelled}
                  icon={AlertTriangle}
                  color="bg-red-500/10 text-red-500"
                />
              </div>
            )}
          </div>

          {/* By status + by priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Por Status</CardTitle>
                <CardDescription>Distribuição dos chamados por status</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="space-y-2">
                    {(stats?.byStatus ?? []).map((row) => {
                      const total = parseInt(stats?.tickets.total || "1", 10) || 1;
                      const pct = Math.round((parseInt(row.count, 10) / total) * 100);
                      return (
                        <div key={row.status} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{statusLabels[row.status] ?? row.status}</span>
                            <span className="font-medium">
                              {row.count}
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({pct}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full ${statusColors[row.status] ?? "bg-primary"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {(stats?.byStatus ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm py-4 text-center">
                        Sem dados
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Categorias</CardTitle>
                <CardDescription>Categorias mais utilizadas</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="space-y-2">
                    {(stats?.topCategories ?? []).slice(0, 8).map((row, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="truncate max-w-[200px]">
                          {row.category ?? "Sem categoria"}
                        </span>
                        <Badge variant="secondary">{row.count}</Badge>
                      </div>
                    ))}
                    {(stats?.topCategories ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm py-4 text-center">
                        Sem dados
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resources + Typing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Saúde dos Recursos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">OK: {stats?.resources.up ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-sm">Degradado: {stats?.resources.degraded ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-sm">Fora do ar: {stats?.resources.down ?? 0}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Digitação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="flex gap-6">
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.typing.totalSessions ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Sessões</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.typing.avgWpm ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">WPM médio</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.typing.avgAccuracy
                          ? `${stats.typing.avgAccuracy}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Precisão</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== AUDIT TAB ===== */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={auditFrom}
                  onChange={(e) => { setAuditFrom(e.target.value); setAuditPage(1); }}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={auditTo}
                  onChange={(e) => { setAuditTo(e.target.value); setAuditPage(1); }}
                  className="w-40"
                />
              </div>
              {(auditFrom || auditTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAuditFrom(""); setAuditTo(""); setAuditPage(1); }}
                >
                  Limpar
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Nenhum log encontrado para o período selecionado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Alvo</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(log.createdAt))}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">
                              {(log as any).actorName || "Sistema"}
                            </p>
                            {(log as any).actorEmail && (
                              <p className="text-xs text-muted-foreground">
                                {(log as any).actorEmail}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.targetType && log.targetId
                              ? `${log.targetType}: ${log.targetId.slice(0, 8)}…`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {log.ip || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={auditPage <= 1}
              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {auditPage}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={auditLogs.length < 50}
              onClick={() => setAuditPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

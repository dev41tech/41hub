import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  User,
  Calendar,
  Filter,
  Download,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/search-input";
import { useToast } from "@/hooks/use-toast";
import type { AuditLog } from "@shared/schema";

interface AuditLogWithActor extends AuditLog {
  actorName?: string;
  actorEmail?: string;
}

const actionLabels: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  resource_access: "Acesso a Recurso",
  resource_create: "Criação de Recurso",
  resource_update: "Atualização de Recurso",
  resource_delete: "Exclusão de Recurso",
  resource_health_update: "Saúde de Recurso",
  user_create: "Criação de Usuário",
  user_update: "Atualização de Usuário",
  sector_create: "Criação de Setor",
  sector_update: "Atualização de Setor",
  sector_delete: "Exclusão de Setor",
  favorite_add: "Adição de Favorito",
  favorite_remove: "Remoção de Favorito",
  alert_create: "Criação de Alerta",
  api_token_create: "Criação de Token",
  api_token_revoke: "Revogação de Token",
};

const getActionBadgeVariant = (action: string) => {
  if (action.includes("delete") || action.includes("remove") || action.includes("revoke"))
    return "destructive";
  if (action.includes("create") || action.includes("add")) return "default";
  if (action.includes("update") || action.includes("health")) return "secondary";
  return "outline";
};

async function downloadExport(url: string, filename: string, toast: any) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      let msg = "Falha ao exportar";
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast({ title: "Exportado com sucesso" });
  } catch (err: any) {
    toast({ title: "Erro ao exportar", description: err?.message, variant: "destructive" });
  }
}

export default function AdminAudit() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState<"csv" | "json" | null>(null);

  const queryUrl = `/api/admin/audit?limit=100&page=${page}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}${actionFilter !== "all" ? `&action=${actionFilter}` : ""}`;

  const { data: logs = [], isLoading } = useQuery<AuditLogWithActor[]>({
    queryKey: [queryUrl],
    queryFn: () => fetch(queryUrl, { credentials: "include" }).then((r) => r.json()),
  });

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.actorName?.toLowerCase().includes(q) ||
      log.actorEmail?.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const handleExport = async (format: "csv" | "json") => {
    setExportLoading(format);
    const url = `/api/admin/reports/audit-logs?format=${format}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
    await downloadExport(url, `audit_logs.${format}`, toast);
    setExportLoading(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
          <FileText className="h-5 w-5 text-chart-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Logs de atividades do sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            {/* Date filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> De
                </Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                  className="w-36 [color-scheme:light] dark:[color-scheme:dark]"
                  data-testid="input-audit-from"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setPage(1); }}
                  className="w-36 [color-scheme:light] dark:[color-scheme:dark]"
                  data-testid="input-audit-to"
                />
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exportLoading === "csv"}
                data-testid="button-export-audit-csv"
              >
                {exportLoading === "csv" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={exportLoading === "json"}
                data-testid="button-export-audit-json"
              >
                {exportLoading === "json" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                JSON
              </Button>
            </div>
          </div>

          {/* Search + action filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <CardTitle className="text-base font-medium self-center">
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
            </CardTitle>
            <div className="flex gap-2 ml-auto">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar logs..."
                className="sm:w-56"
              />
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-action-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {actionLabels[action] || action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || actionFilter !== "all" || from || to
                ? "Nenhum log encontrado para os filtros selecionados"
                : "Nenhum log registrado"}
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
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{log.actorName || "Sistema"}</p>
                            {log.actorEmail && (
                              <p className="text-xs text-muted-foreground">
                                {log.actorEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.targetType && log.targetId ? (
                          <span className="text-sm">
                            {log.targetType}: {log.targetId.slice(0, 8)}...
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {log.ip || "-"}
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
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">Página {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={logs.length < 100}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

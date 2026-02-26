import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, User, Calendar, Filter } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  user_create: "Criação de Usuário",
  user_update: "Atualização de Usuário",
  sector_create: "Criação de Setor",
  sector_update: "Atualização de Setor",
  sector_delete: "Exclusão de Setor",
  favorite_add: "Adição de Favorito",
  favorite_remove: "Remoção de Favorito",
};

const getActionBadgeVariant = (action: string) => {
  if (action.includes("delete") || action.includes("remove")) return "destructive";
  if (action.includes("create") || action.includes("add")) return "default";
  if (action.includes("update")) return "secondary";
  return "outline";
};

export default function AdminAudit() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<AuditLogWithActor[]>({
    queryKey: ["/api/admin/audit"],
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.actorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
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
            Visualize logs de atividades do sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <CardTitle className="text-base font-medium">
            {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar logs..."
              className="sm:w-64"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
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
              {searchQuery || actionFilter !== "all"
                ? "Nenhum log encontrado"
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
                              <p className="text-xs text-muted-foreground">{log.actorEmail}</p>
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
    </div>
  );
}

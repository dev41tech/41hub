import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket,
  Plus,
  Search,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react";
import type { TicketWithDetails, TicketSlaCycle } from "@shared/schema";

const statusLabels: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em Andamento",
  AGUARDANDO_USUARIO: "Aguardando Usuário",
  RESOLVIDO: "Resolvido",
  CANCELADO: "Cancelado",
};

const priorityLabels: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const priorityColors: Record<string, string> = {
  BAIXA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MEDIA: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ALTA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  URGENTE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusColors: Record<string, string> = {
  ABERTO: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EM_ANDAMENTO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  AGUARDANDO_USUARIO: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  RESOLVIDO: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  CANCELADO: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

function getSlaStatus(cycle: TicketSlaCycle | null | undefined): { label: string; color: string } {
  if (!cycle) return { label: "—", color: "" };
  if (cycle.resolvedAt) {
    return cycle.resolutionBreached
      ? { label: "Estourado", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" }
      : { label: "Concluído", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
  }

  const now = new Date();
  const resDue = new Date(cycle.resolutionDueAt);
  const timeLeft = resDue.getTime() - now.getTime();
  const hoursLeft = timeLeft / (1000 * 60 * 60);

  if (timeLeft < 0) return { label: "Estourado", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
  if (hoursLeft < 4) return { label: "Em risco", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
  return { label: "Em dia", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketsIndex() {
  const { user } = useAuth();
  const [tab, setTab] = useState("ativos");
  const [search, setSearch] = useState("");

  const isAdminOrCoord = user?.isAdmin || user?.roles?.some(r => r.roleName === "Coordenador");

  const { data: activeTickets = [], isLoading: loadingActive } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/tickets", { includeClosed: false, q: search || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/tickets?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const { data: allTickets = [], isLoading: loadingAll } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/tickets", { includeClosed: true, q: search || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams({ includeClosed: "true" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/tickets?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
    enabled: tab === "historico",
  });

  const ticketsToShow = tab === "ativos" ? activeTickets : allTickets;
  const isLoading = tab === "ativos" ? loadingActive : loadingAll;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Chamados</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe e gerencie chamados de suporte
            </p>
          </div>
        </div>
        {isAdminOrCoord && (
          <Link href="/tickets/new">
            <Button data-testid="button-new-ticket">
              <Plus className="mr-2 h-4 w-4" />
              Novo Chamado
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar chamados..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-tickets"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ativos" data-testid="tab-active">Ativos</TabsTrigger>
          <TabsTrigger value="historico" data-testid="tab-history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : ticketsToShow.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum chamado encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {ticketsToShow.map((ticket) => {
                const sla = getSlaStatus(ticket.currentCycle);
                return (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`ticket-${ticket.id}`}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{ticket.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{ticket.categoryBranch}/{ticket.categoryName}</span>
                            <span>·</span>
                            <span>{ticket.requesterSectorName}</span>
                            <span>·</span>
                            <span>{ticket.creatorName}</span>
                            <span>·</span>
                            <span>{formatDate(ticket.createdAt as any)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sla.color && (
                            <Badge variant="secondary" className={sla.color} data-testid={`sla-badge-${ticket.id}`}>
                              <Clock className="h-3 w-3 mr-1" />
                              {sla.label}
                            </Badge>
                          )}
                          <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                            {priorityLabels[ticket.priority]}
                          </Badge>
                          <Badge variant="secondary" className={statusColors[ticket.status]}>
                            {statusLabels[ticket.status]}
                          </Badge>
                          {ticket.assignees && ticket.assignees.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{ticket.assignees.length}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

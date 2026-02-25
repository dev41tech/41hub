import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  Paperclip,
  Upload,
  Download,
  Loader2,
  Users,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  TicketWithDetails,
  TicketComment,
  TicketAttachment,
  TicketSlaCycle,
  TicketCategoryTree,
  Sector,
} from "@shared/schema";

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

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSlaInfo(cycle: TicketSlaCycle | null | undefined) {
  if (!cycle) return null;
  const now = new Date();
  const resDue = new Date(cycle.resolutionDueAt);
  const firstDue = new Date(cycle.firstResponseDueAt);

  let resStatus = "Em dia";
  let resColor = "text-green-600";
  if (cycle.resolvedAt) {
    resStatus = cycle.resolutionBreached ? "Estourado" : "Concluído";
    resColor = cycle.resolutionBreached ? "text-red-600" : "text-green-600";
  } else if (now > resDue) {
    resStatus = "Estourado";
    resColor = "text-red-600";
  } else if ((resDue.getTime() - now.getTime()) / (1000 * 60 * 60) < 4) {
    resStatus = "Em risco";
    resColor = "text-yellow-600";
  }

  let firstStatus = "Pendente";
  let firstColor = "text-yellow-600";
  if (cycle.firstResponseAt) {
    firstStatus = cycle.firstResponseBreached ? "Estourado" : "Respondido";
    firstColor = cycle.firstResponseBreached ? "text-red-600" : "text-green-600";
  } else if (now > firstDue) {
    firstStatus = "Estourado";
    firstColor = "text-red-600";
  }

  return { resStatus, resColor, firstStatus, firstColor, cycle };
}

type CommentWithAuthor = TicketComment & { authorName?: string; authorEmail?: string };

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

export default function TicketsDetail() {
  const [, params] = useRoute("/tickets/:id");
  const ticketId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin;

  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneesInitialized, setAssigneesInitialized] = useState(false);

  const { data: ticket, isLoading } = useQuery<TicketWithDetails>({
    queryKey: ["/api/tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!ticketId,
  });

  const { data: comments = [] } = useQuery<CommentWithAuthor[]>({
    queryKey: ["/api/tickets", ticketId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!ticketId,
  });

  const { data: attachments = [] } = useQuery<TicketAttachment[]>({
    queryKey: ["/api/tickets", ticketId, "attachments"],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!ticketId,
  });

  const { data: techUsers = [] } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/users/directory", "tech"],
    queryFn: async () => {
      const res = await fetch("/api/users/directory?all=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!isAdmin,
  });

  if (ticket && !assigneesInitialized && ticket.assignees) {
    setSelectedAssignees(ticket.assignees.map(a => a.userId));
    setAssigneesInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/tickets/${ticketId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketId] });
      toast({ title: "Chamado atualizado" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assigneeIds: string[]) => {
      await apiRequest("PUT", `/api/tickets/${ticketId}/assignees`, { assigneeIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketId] });
      toast({ title: "Responsáveis atualizados" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tickets/${ticketId}/comments`, {
        body: commentBody,
        isInternal,
      });
      return res.json();
    },
    onSuccess: () => {
      setCommentBody("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketId, "comments"] });
      toast({ title: "Comentário adicionado" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticketId, "attachments"] });
      toast({ title: "Anexo enviado" });
    },
    onError: (e: any) => {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    },
  });

  const canComment = isAdmin || ticket?.status === "AGUARDANDO_USUARIO";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Chamado não encontrado
      </div>
    );
  }

  const slaInfo = getSlaInfo(ticket.currentCycle);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/tickets">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{ticket.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{ticket.creatorName}</span>
            <span>·</span>
            <span>{ticket.requesterSectorName}</span>
            <span>·</span>
            <span>{formatDate(ticket.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={priorityColors[ticket.priority]}>
            {priorityLabels[ticket.priority]}
          </Badge>
          <Badge variant="secondary" className={statusColors[ticket.status]}>
            {statusLabels[ticket.status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentários ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda
                </p>
              ) : (
                comments.map(c => (
                  <div
                    key={c.id}
                    className={`border rounded-lg p-3 ${c.isInternal ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" : ""}`}
                    data-testid={`comment-${c.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {c.authorName || c.authorEmail || "Sistema"}
                        {c.isInternal && <Badge variant="outline" className="ml-2 text-xs">Interno</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}

              {canComment && (
                <div className="space-y-3 pt-2 border-t">
                  <Textarea
                    placeholder="Escreva um comentário..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={3}
                    data-testid="input-comment"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={isInternal}
                            onCheckedChange={(v) => setIsInternal(v === true)}
                            data-testid="checkbox-internal"
                          />
                          Comentário interno
                        </label>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => commentMutation.mutate()}
                      disabled={!commentBody.trim() || commentMutation.isPending}
                      data-testid="button-send-comment"
                    >
                      {commentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos ({attachments.length})
              </CardTitle>
              {canComment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".jpg,.jpeg,.png,.pdf";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) uploadMutation.mutate(file);
                    };
                    input.click();
                  }}
                  disabled={uploadMutation.isPending}
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum anexo
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-2" data-testid={`attachment-${a.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {(a.sizeBytes / 1024).toFixed(1)} KB · {formatDate(a.createdAt)}
                        </p>
                      </div>
                      <a
                        href={`/api/tickets/${ticketId}/attachments/${a.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" data-testid={`download-${a.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {slaInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  SLA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primeira resposta</span>
                  <span className={`font-medium ${slaInfo.firstColor}`}>{slaInfo.firstStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo resp.</span>
                  <span className="text-xs">{formatDate(slaInfo.cycle.firstResponseDueAt)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolução</span>
                  <span className={`font-medium ${slaInfo.resColor}`}>{slaInfo.resStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo resolução</span>
                  <span className="text-xs">{formatDate(slaInfo.cycle.resolutionDueAt)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ciclo</span>
                  <span>#{slaInfo.cycle.cycleNumber}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria</span>
                <span>{ticket.categoryBranch}/{ticket.categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setor destino</span>
                <span>{ticket.targetSectorName}</span>
              </div>
              {ticket.assignees && ticket.assignees.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Responsáveis</span>
                  <div className="mt-1 space-y-1">
                    {ticket.assignees.map(a => (
                      <div key={a.userId} className="text-xs">{a.userName}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações Admin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => updateMutation.mutate({ status: v })}
                  >
                    <SelectTrigger data-testid="admin-select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABERTO">Aberto</SelectItem>
                      <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                      <SelectItem value="AGUARDANDO_USUARIO">Aguardando Usuário</SelectItem>
                      <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Prioridade</Label>
                  <Select
                    value={ticket.priority}
                    onValueChange={(v) => updateMutation.mutate({ priority: v })}
                  >
                    <SelectTrigger data-testid="admin-select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Responsáveis
                  </Label>
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {techUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                        <Checkbox
                          checked={selectedAssignees.includes(u.id)}
                          onCheckedChange={(checked) => {
                            setSelectedAssignees(prev =>
                              checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            );
                          }}
                        />
                        <span className="truncate">{u.name}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => assignMutation.mutate(selectedAssignees)}
                    disabled={assignMutation.isPending}
                    data-testid="button-save-assignees"
                  >
                    {assignMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Salvar Responsáveis"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

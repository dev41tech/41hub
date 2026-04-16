import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Puzzle,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code2,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ApiToken {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  createdByName: string | null;
}

const BASE_URL = window.location.origin + "/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-md bg-muted p-3 pr-10 text-xs font-mono whitespace-pre-wrap break-all">
      <CopyButton text={code} />
      <div className="absolute top-2 right-2" />
      {code}
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/15 text-green-600 dark:text-green-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function EndpointRow({
  method,
  path,
  desc,
  scope,
  queryParams,
  body,
  response,
}: {
  method: string;
  path: string;
  desc: string;
  scope: "read" | "write";
  queryParams?: string;
  body?: string;
  response?: string;
}) {
  return (
    <div className="space-y-1.5 py-2 border-b last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${METHOD_COLORS[method] ?? ""}`}
        >
          {method}
        </span>
        <code className="text-xs font-mono text-foreground flex-1 min-w-0 break-all">{path}</code>
        <Badge variant={scope === "write" ? "default" : "secondary"} className="text-xs shrink-0">
          {scope}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      {queryParams && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Query params:</span> {queryParams}
        </p>
      )}
      {body && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-medium">Body (JSON)</summary>
          <pre className="mt-1 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">{body}</pre>
        </details>
      )}
      {response && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-medium">Resposta (exemplo)</summary>
          <pre className="mt-1 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">{response}</pre>
        </details>
      )}
    </div>
  );
}

function EndpointGroup({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${color}`}>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0 px-4">{children}</CardContent>
    </Card>
  );
}

export default function AdminIntegrations() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenScope, setNewTokenScope] = useState("read");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/admin/integrations/tokens"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[] }) =>
      apiRequest("POST", "/api/admin/integrations/tokens", data),
    onSuccess: async (res) => {
      const data = await res.json();
      setGeneratedToken(data.token);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/tokens"] });
      toast({ title: "Token criado — copie antes de fechar!" });
    },
    onError: () => toast({ title: "Erro ao criar token", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/integrations/tokens/${id}`),
    onSuccess: () => {
      toast({ title: "Token revogado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/tokens"] });
    },
    onError: () => toast({ title: "Erro ao revogar token", variant: "destructive" }),
  });

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <Puzzle className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            API REST, Tokens e Webhooks para integrações externas
          </p>
        </div>
      </div>

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">
            <Key className="h-4 w-4 mr-2" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="docs">
            <Code2 className="h-4 w-4 mr-2" />
            Documentação
          </TabsTrigger>
        </TabsList>

        {/* ===== TOKENS TAB ===== */}
        <TabsContent value="tokens" className="space-y-4 mt-4">
          {/* Generated token banner */}
          {generatedToken && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Token gerado — copie agora, não será exibido novamente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {showToken ? generatedToken : "•".repeat(Math.min(generatedToken.length, 40))}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowToken((s) => !s)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <CopyButton text={generatedToken} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGeneratedToken(null)}
                >
                  Fechar
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Tokens ativos</h2>
              <p className="text-xs text-muted-foreground">
                Tokens de API para integração com sistemas externos
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo token
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activeTokens.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Nenhum token ativo. Crie um para começar a integrar.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeTokens.map((token) => (
                <Card key={token.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 shrink-0">
                      <Key className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{token.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {token.scopes.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <p>
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                          new Date(token.createdAt)
                        )}
                      </p>
                      {token.createdByName && <p>por {token.createdByName}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => setRevokeId(token.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {revokedTokens.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">
                Tokens revogados ({revokedTokens.length})
              </p>
              <div className="space-y-2 opacity-60">
                {revokedTokens.map((token) => (
                  <Card key={token.id}>
                    <CardContent className="flex items-center gap-4 p-3">
                      <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-through text-muted-foreground">
                          {token.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        Revogado em{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                          new Date(token.revokedAt!)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== DOCS TAB ===== */}
        <TabsContent value="docs" className="space-y-6 mt-4">
          {/* Base URL + Auth */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Base URL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {BASE_URL}
                  </code>
                  <CopyButton text={BASE_URL} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Autenticação</CardTitle>
                <CardDescription>Header obrigatório em todas as requisições</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <CodeBlock code={`Authorization: Bearer hub_<token>`} />
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary">read</Badge>
                  <span className="text-muted-foreground">somente leitura</span>
                  <Badge variant="secondary" className="ml-2">write</Badge>
                  <span className="text-muted-foreground">leitura e escrita</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resources */}
          <EndpointGroup title="Recursos (Resources)" color="bg-blue-500/10 text-blue-500">
            <EndpointRow method="GET" path="/api/resources" desc="Lista recursos visíveis ao usuário autenticado" scope="read"
              response={`[{ "id": "uuid", "name": "App X", "type": "APP", "url": "https://...", "healthStatus": "UP", "tags": [] }]`} />
            <EndpointRow method="GET" path="/api/admin/resources" desc="Lista todos os recursos (admin)" scope="read"
              response={`[{ "id": "uuid", "name": "App X", "type": "APP|DASHBOARD", "isActive": true }]`} />
            <EndpointRow method="POST" path="/api/admin/resources" desc="Cria recurso" scope="write"
              body={`{ "name": "string", "type": "APP|DASHBOARD", "url": "string", "sectorId": "uuid", "embedMode": "LINK|IFRAME|POWERBI" }`} />
            <EndpointRow method="PATCH" path="/api/admin/resources/:id" desc="Atualiza recurso" scope="write"
              body={`{ "name": "string", "isActive": true }`} />
            <EndpointRow method="DELETE" path="/api/admin/resources/:id" desc="Remove recurso" scope="write" />
          </EndpointGroup>

          {/* Tickets */}
          <EndpointGroup title="Chamados (Tickets)" color="bg-amber-500/10 text-amber-500">
            <EndpointRow method="GET" path="/api/tickets" desc="Lista chamados do usuário (abertos e históricos)" scope="read"
              queryParams="status, priority, from, to"
              response={`[{ "id": "uuid", "title": "string", "status": "ABERTO|EM_ANDAMENTO|RESOLVIDO|CANCELADO", "priority": "BAIXA|MEDIA|ALTA|URGENTE" }]`} />
            <EndpointRow method="GET" path="/api/tickets/:id" desc="Detalhe de um chamado" scope="read" />
            <EndpointRow method="POST" path="/api/tickets" desc="Abre novo chamado" scope="write"
              body={`{ "title": "string", "description": "string", "categoryId": "uuid", "priority": "MEDIA" }`} />
            <EndpointRow method="PATCH" path="/api/tickets/:id" desc="Atualiza status / prioridade (assignee ou admin)" scope="write"
              body={`{ "status": "EM_ANDAMENTO", "priority": "ALTA" }`} />
          </EndpointGroup>

          {/* Ticket Comments */}
          <EndpointGroup title="Comentários de Chamado" color="bg-purple-500/10 text-purple-500">
            <EndpointRow method="GET" path="/api/tickets/:id/comments" desc="Lista comentários do chamado" scope="read" />
            <EndpointRow method="POST" path="/api/tickets/:id/comments" desc="Adiciona comentário" scope="write"
              body={`{ "body": "string", "isInternal": false }`} />
          </EndpointGroup>

          {/* Ticket Categories */}
          <EndpointGroup title="Categorias de Chamado" color="bg-green-500/10 text-green-500">
            <EndpointRow method="GET" path="/api/tickets/categories" desc="Árvore de categorias (branch → serviço)" scope="read"
              response={`[{ "id": "uuid", "name": "string", "branch": "string", "parentId": null }]`} />
          </EndpointGroup>

          {/* Alerts */}
          <EndpointGroup title="Alertas (System Alerts)" color="bg-red-500/10 text-red-500">
            <EndpointRow method="GET" path="/api/alerts" desc="Alertas ativos para o usuário (inclui isRead)" scope="read"
              queryParams="active=true|false"
              response={`[{ "id": "uuid", "title": "string", "message": "string", "severity": "info|warning|critical", "isRead": false }]`} />
            <EndpointRow method="POST" path="/api/alerts/:id/read" desc="Marca alerta como lido" scope="write" />
            <EndpointRow method="POST" path="/api/admin/alerts" desc="Cria alerta (admin)" scope="write"
              body={`{ "title": "string", "message": "string", "severity": "info|warning|critical", "isActive": true }`} />
            <EndpointRow method="PATCH" path="/api/admin/alerts/:id" desc="Atualiza alerta (admin)" scope="write" />
            <EndpointRow method="DELETE" path="/api/admin/alerts/:id" desc="Remove alerta (admin)" scope="write" />
          </EndpointGroup>

          {/* Notifications */}
          <EndpointGroup title="Notificações" color="bg-sky-500/10 text-sky-500">
            <EndpointRow method="GET" path="/api/notifications" desc="Lista notificações do usuário" scope="read"
              response={`[{ "id": "uuid", "type": "alert|ticket|...", "title": "string", "isRead": false }]`} />
            <EndpointRow method="POST" path="/api/notifications/:id/read" desc="Marca notificação como lida" scope="write" />
            <EndpointRow method="POST" path="/api/notifications/read-all" desc="Marca todas como lidas" scope="write" />
          </EndpointGroup>

          {/* KB Articles */}
          <EndpointGroup title="Base de Conhecimento (KB)" color="bg-chart-1/10 text-chart-1">
            <EndpointRow method="GET" path="/api/kb" desc="Lista artigos publicados" scope="read"
              queryParams="q (busca), categoryId, tags"
              response={`[{ "id": "uuid", "title": "string", "body": "markdown", "categoryName": "string", "viewCount": 0 }]`} />
            <EndpointRow method="GET" path="/api/kb/:id" desc="Artigo completo (registra visualização)" scope="read" />
            <EndpointRow method="POST" path="/api/kb/:id/feedback" desc="Envia feedback de utilidade" scope="write"
              body={`{ "helpful": true }`} />
            <EndpointRow method="GET" path="/api/admin/kb" desc="Lista todos (admin, inclui rascunhos)" scope="read" />
            <EndpointRow method="POST" path="/api/admin/kb" desc="Cria artigo (admin)" scope="write"
              body={`{ "title": "string", "body": "markdown", "categoryId": "uuid", "isPublished": true }`} />
            <EndpointRow method="PATCH" path="/api/admin/kb/:id" desc="Atualiza artigo (admin)" scope="write" />
            <EndpointRow method="DELETE" path="/api/admin/kb/:id" desc="Remove artigo (admin)" scope="write" />
          </EndpointGroup>

          {/* Audit Logs */}
          <EndpointGroup title="Logs de Auditoria" color="bg-slate-500/10 text-slate-500">
            <EndpointRow method="GET" path="/api/admin/audit" desc="Lista logs de auditoria (admin)" scope="read"
              queryParams="limit, page, from, to"
              response={`[{ "id": "uuid", "action": "resource_create", "actorName": "string", "targetType": "string", "targetId": "uuid", "ip": "string" }]`} />
          </EndpointGroup>

          {/* Reports */}
          <EndpointGroup title="Relatórios (Reports)" color="bg-emerald-500/10 text-emerald-500">
            <EndpointRow method="GET" path="/api/admin/reports/tickets" desc="Exporta chamados (admin)" scope="read"
              queryParams="format=csv|json, from=YYYY-MM-DD, to=YYYY-MM-DD" />
            <EndpointRow method="GET" path="/api/admin/reports/resources" desc="Exporta recursos (admin)" scope="read"
              queryParams="format=csv|json, includeInactive=true" />
            <EndpointRow method="GET" path="/api/admin/reports/users" desc="Exporta usuários (admin)" scope="read"
              queryParams="format=csv|json" />
            <EndpointRow method="GET" path="/api/admin/reports/typing" desc="Exporta sessões de digitação (admin)" scope="read"
              queryParams="format=csv|json" />
          </EndpointGroup>

          {/* Error codes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Códigos de Erro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 text-xs">
                {[
                  ["400", "Bad Request", "Dados inválidos no body/query"],
                  ["401", "Unauthorized", "Token ausente ou inválido"],
                  ["403", "Forbidden", "Escopo insuficiente (read vs write) ou não é admin"],
                  ["404", "Not Found", "Recurso não encontrado"],
                  ["503", "Service Unavailable", "Tabela/coluna ausente no banco — execute as migrations"],
                  ["500", "Internal Server Error", "Erro inesperado no servidor"],
                ].map(([code, label, desc]) => (
                  <div key={code} className="flex items-start gap-3">
                    <Badge variant={code === "500" || code === "503" ? "destructive" : "outline"} className="shrink-0 font-mono">
                      {code}
                    </Badge>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Webhook payload */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Webhooks</CardTitle>
              <CardDescription>
                Configure em Admin → Config. Chamados → Integrações para receber eventos em tempo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={`POST <sua_url>  HTTP/1.1
Content-Type: application/json
X-Hub-Event: ticket_created

{
  "event": "ticket_created",
  "timestamp": "2026-04-16T14:00:00.000Z",
  "data": {
    "ticketId": "uuid",
    "title": "Problema com acesso",
    "status": "ABERTO",
    "priority": "ALTA"
  }
}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Token Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo token de API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do token</Label>
              <Input
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Ex: n8n-integration, slack-bot"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Escopo</Label>
              <Select value={newTokenScope} onValueChange={setNewTokenScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">read — somente leitura</SelectItem>
                  <SelectItem value="write">write — leitura e escrita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              O token será exibido <strong>uma única vez</strong> após a criação. Guarde-o em
              local seguro.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: newTokenName,
                  scopes: [newTokenScope],
                })
              }
              disabled={!newTokenName.trim() || createMutation.isPending}
            >
              Gerar token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <AlertDialog
        open={revokeId !== null}
        onOpenChange={(o) => !o && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar token?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Qualquer integração usando este token parará de
              funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeId) revokeMutation.mutate(revokeId);
                setRevokeId(null);
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
              <CardDescription>
                Use o token no header Authorization em todas as requisições.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CodeBlock code={`Authorization: Bearer hub_<seu_token>`} />
              <p className="text-xs text-muted-foreground">
                Tokens com escopo <code className="bg-muted px-1 rounded">read</code> permitem
                apenas leitura. Tokens com{" "}
                <code className="bg-muted px-1 rounded">write</code> permitem criação e edição.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Exemplos de requisições</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Listar recursos ativos
                </p>
                <CodeBlock
                  code={`curl -s "${BASE_URL}/resources" \\
  -H "Authorization: Bearer hub_<token>"`}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Listar chamados
                </p>
                <CodeBlock
                  code={`curl -s "${BASE_URL}/tickets" \\
  -H "Authorization: Bearer hub_<token>"`}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Alertas ativos
                </p>
                <CodeBlock
                  code={`curl -s "${BASE_URL}/alerts?active=true" \\
  -H "Authorization: Bearer hub_<token>"`}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Exportar chamados (CSV)
                </p>
                <CodeBlock
                  code={`curl -s "${BASE_URL}/admin/reports/tickets?format=csv&from=2026-01-01" \\
  -H "Authorization: Bearer hub_<token>" \\
  -o tickets.csv`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Webhooks de eventos</CardTitle>
              <CardDescription>
                Configure webhooks em Admin → Configurações para receber eventos em tempo real
                (ticket_created, ticket_updated, resource_updated, alert_created, etc).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={`// Payload de exemplo (ticket_created)
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

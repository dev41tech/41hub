import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
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
import { ArrowLeft, Loader2, FileText, BookOpen, ThumbsUp, ExternalLink, Paperclip } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import type { Sector, TicketCategoryTree, KbArticle } from "@shared/schema";

type KbArticleWithMeta = KbArticle & {
  categoryName?: string;
  helpfulCount?: number;
  viewCount?: number;
};

export default function TicketsNew() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const isAdmin = user?.isAdmin;
  const isCoordinator = !isAdmin && user?.roles?.some(r => r.roleName === "Coordenador");
  const isUser = !isAdmin && !isCoordinator;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterSectorId, setRequesterSectorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const pendingTemplate = useRef("");
  const [requestData, setRequestData] = useState<Record<string, string>>({});

  const { data: adminSectors = [] } = useQuery<Sector[]>({
    queryKey: ["/api/admin/sectors"],
    enabled: !!isAdmin,
  });

  const { data: categories = [] } = useQuery<TicketCategoryTree[]>({
    queryKey: ["/api/tickets/categories"],
  });

  const { data: kbSuggestions = [] } = useQuery<KbArticleWithMeta[]>({
    queryKey: ["/api/kb", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const res = await fetch(`/api/kb?categoryId=${categoryId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!categoryId,
  });

  const availableSectors: Array<{ id: string; name: string }> = (() => {
    if (isAdmin) return adminSectors;
    if (!user?.roles) return [];
    const sectorMap = new Map<string, string>();
    for (const r of user.roles) {
      if (r.roleName === "Coordenador") {
        sectorMap.set(r.sectorId, r.sectorName);
      }
    }
    if (sectorMap.size === 0) {
      for (const r of user.roles) {
        sectorMap.set(r.sectorId, r.sectorName);
      }
    }
    return Array.from(sectorMap, ([id, name]) => ({ id, name }));
  })();

  useEffect(() => {
    if (availableSectors.length === 1 && !requesterSectorId) {
      setRequesterSectorId(availableSectors[0].id);
    }
  }, [availableSectors, requesterSectorId]);

  const allCategories = categories.flatMap(root => {
    const items = [root];
    if (root.children) items.push(...root.children);
    return items;
  });

  const selectedCategory = allCategories.find(c => c.id === categoryId);
  const categoryTemplate = (selectedCategory as any)?.descriptionTemplate || "";

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    setRequestData({});
    const cat = allCategories.find(c => c.id === newCategoryId);
    const template = (cat as any)?.descriptionTemplate || "";
    if (template) {
      if (!description.trim()) {
        setDescription(template);
      }
    }
  }

  type FormFieldRule = { regex?: string; minLen?: number; maxLen?: number; min?: number; max?: number };
  type FormField = { key: string; label: string; type: string; required?: boolean; options?: string[]; placeholder?: string; helpText?: string; rules?: FormFieldRule };
  type RequiredAttachment = { key: string; label: string; mime?: string[]; required?: boolean };

  const selectedFormSchema: FormField[] = (selectedCategory as any)?.formSchema || [];
  const selectedRequiredAttachments: RequiredAttachment[] = (selectedCategory as any)?.requiredAttachments || [];

  function handleInsertTemplate() {
    if (description.trim()) {
      pendingTemplate.current = categoryTemplate;
      setShowTemplateConfirm(true);
    } else {
      setDescription(categoryTemplate);
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const sectorId = requesterSectorId || (availableSectors.length === 1 ? availableSectors[0].id : "");
      const payload: Record<string, any> = {
        title,
        description,
        requesterSectorId: sectorId,
        categoryId,
        priority,
      };
      if (selectedFormSchema.length > 0) {
        payload.requestData = requestData;
      }
      const res = await apiRequest("POST", "/api/tickets", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Chamado criado com sucesso" });
      navigate(`/tickets/${data.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar chamado", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const effectiveSectorId = requesterSectorId || (availableSectors.length === 1 ? availableSectors[0].id : "");

  useEffect(() => {
    if (isUser) {
      navigate("/tickets");
    }
  }, [isUser, navigate]);

  if (isUser) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/tickets">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Novo Chamado</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para abrir um chamado de suporte
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {availableSectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-sector">
              Usuário sem setor vinculado. Não é possível abrir chamados.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {availableSectors.length === 1 ? (
                <div className="space-y-2">
                  <Label>Setor Solicitante</Label>
                  <p className="text-sm font-medium px-3 py-2 border rounded-md bg-muted" data-testid="text-sector-auto">
                    {availableSectors[0].name}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="requesterSectorId">Setor Solicitante</Label>
                  <Select value={requesterSectorId} onValueChange={setRequesterSectorId}>
                    <SelectTrigger data-testid="select-sector">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSectors.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <Select value={categoryId} onValueChange={handleCategoryChange}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(root => (
                      <SelectGroup key={root.id}>
                        <SelectLabel>{root.name}</SelectLabel>
                        {root.children && root.children.length > 0 ? (
                          root.children.map(child => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={root.id}>{root.name}</SelectItem>
                        )}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {kbSuggestions.length > 0 && (
                <Card className="border-chart-1/30 bg-chart-1/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4 text-chart-1" />
                      <span className="text-sm font-medium">Artigos que podem ajudar</span>
                      <Badge variant="secondary" className="text-xs">{kbSuggestions.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {kbSuggestions.slice(0, 3).map(article => (
                        <a
                          key={article.id}
                          href={`/api/kb/${article.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 hover-elevate cursor-pointer"
                          data-testid={`kb-suggestion-${article.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{article.title}</p>
                            {article.helpfulCount !== undefined && article.helpfulCount > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <ThumbsUp className="h-3 w-3" />
                                <span>{article.helpfulCount}</span>
                              </div>
                            )}
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-priority">
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

              {selectedFormSchema.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium">Dados do serviço</p>
                    {selectedFormSchema.map(field => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-sm">
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                        {field.type === "textarea" ? (
                          <Textarea
                            value={requestData[field.key] || ""}
                            onChange={e => setRequestData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            rows={3}
                            data-testid={`field-${field.key}`}
                          />
                        ) : field.type === "select" && field.options ? (
                          <Select
                            value={requestData[field.key] || ""}
                            onValueChange={v => setRequestData(prev => ({ ...prev, [field.key]: v }))}
                          >
                            <SelectTrigger data-testid={`field-${field.key}`}>
                              <SelectValue placeholder={field.placeholder || "Selecione..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                            value={requestData[field.key] || ""}
                            onChange={e => setRequestData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            min={field.rules?.min}
                            max={field.rules?.max}
                            minLength={field.rules?.minLen}
                            maxLength={field.rules?.maxLen}
                            data-testid={`field-${field.key}`}
                          />
                        )}
                        {field.rules && (
                          <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                            {field.rules.minLen && <span>Mín. {field.rules.minLen} chars</span>}
                            {field.rules.maxLen && <span>Máx. {field.rules.maxLen} chars</span>}
                            {field.rules.min !== undefined && <span>Mín. {field.rules.min}</span>}
                            {field.rules.max !== undefined && <span>Máx. {field.rules.max}</span>}
                            {field.rules.regex && <span>Padrão: {field.rules.regex}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {selectedRequiredAttachments.length > 0 && (
                <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-orange-600" />
                      <p className="text-sm font-medium">Anexos necessários</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Os anexos abaixo devem ser enviados após a criação do chamado.
                    </p>
                    <div className="space-y-1">
                      {selectedRequiredAttachments.map(att => (
                        <div key={att.key} className="flex items-center gap-2 text-sm" data-testid={`required-att-${att.key}`}>
                          <Badge variant={att.required ? "destructive" : "outline"} className="text-[10px]">
                            {att.required ? "obrigatório" : "opcional"}
                          </Badge>
                          <span>{att.label}</span>
                          {att.mime && att.mime.length > 0 && (
                            <span className="text-xs text-muted-foreground">({att.mime.join(", ")})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Descreva brevemente o problema"
                  required
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Descrição</Label>
                  {categoryTemplate && description.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertTemplate}
                      data-testid="button-insert-template"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Inserir template
                    </Button>
                  )}
                </div>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhe o problema ou solicitação..."
                  rows={6}
                  required
                  data-testid="input-description"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/tickets">
                  <Button variant="outline" type="button">Cancelar</Button>
                </Link>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !title || !description || !effectiveSectorId || !categoryId}
                  data-testid="button-submit-ticket"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Chamado"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showTemplateConfirm} onOpenChange={setShowTemplateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir descrição?</AlertDialogTitle>
            <AlertDialogDescription>
              A descrição atual será substituída pelo template da categoria. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setDescription(pendingTemplate.current);
              setShowTemplateConfirm(false);
            }}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

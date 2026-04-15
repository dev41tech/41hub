import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  BookOpen,
  ThumbsUp,
  ExternalLink,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
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

type FormFieldRule = {
  regex?: string;
  minLen?: number;
  maxLen?: number;
  min?: number;
  max?: number;
};
type FormField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  rules?: FormFieldRule;
};
type RequiredAttachment = {
  key: string;
  label: string;
  mime?: string[];
  required?: boolean;
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : step}
            </div>
            {step < total && (
              <div
                className={`h-0.5 w-8 ${
                  done ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TicketsNew() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const isAdmin = user?.isAdmin;
  const isCoordinator = !isAdmin && user?.roles?.some((r) => r.roleName === "Coordenador");
  const isUser = !isAdmin && !isCoordinator;

  // Wizard step: 1 = categoria, 2 = detalhes
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterSectorId, setRequesterSectorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
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
      const res = await fetch(`/api/kb?categoryId=${categoryId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!categoryId,
  });

  const availableSectors: Array<{ id: string; name: string }> = (() => {
    if (isAdmin) return adminSectors;
    if (!user?.roles) return [];
    const map = new Map<string, string>();
    for (const r of user.roles) {
      if (r.roleName === "Coordenador") map.set(r.sectorId, r.sectorName);
    }
    if (map.size === 0) {
      for (const r of user.roles) map.set(r.sectorId, r.sectorName);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  })();

  useEffect(() => {
    if (availableSectors.length === 1 && !requesterSectorId) {
      setRequesterSectorId(availableSectors[0].id);
    }
  }, [availableSectors, requesterSectorId]);

  const allCategories = categories.flatMap((root) => {
    const items: TicketCategoryTree[] = [root];
    if (root.children) items.push(...root.children);
    return items;
  });

  const filteredCategories = categorySearch.trim()
    ? allCategories.filter((c) =>
        c.name.toLowerCase().includes(categorySearch.toLowerCase())
      )
    : allCategories;

  const selectedCategory = allCategories.find((c) => c.id === categoryId);
  const categoryTemplate = (selectedCategory as any)?.descriptionTemplate || "";
  const selectedFormSchema: FormField[] =
    (selectedCategory as any)?.formSchema || [];
  const selectedRequiredAttachments: RequiredAttachment[] =
    (selectedCategory as any)?.requiredAttachments || [];

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    setRequestData({});
    const cat = allCategories.find((c) => c.id === newCategoryId);
    const template = (cat as any)?.descriptionTemplate || "";
    if (template && !description.trim()) {
      setDescription(template);
    }
  }

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
      const sectorId =
        requesterSectorId ||
        (availableSectors.length === 1 ? availableSectors[0].id : "");
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
      toast({
        title: "Erro ao criar chamado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const effectiveSectorId =
    requesterSectorId ||
    (availableSectors.length === 1 ? availableSectors[0].id : "");

  useEffect(() => {
    if (isUser) navigate("/tickets");
  }, [isUser, navigate]);

  if (isUser) return null;

  const canProceedStep1 = !!categoryId;
  const canSubmit =
    !!title && !!description && !!effectiveSectorId && !!categoryId;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === 2 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep(1)}
            data-testid="button-back-step"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Link href="/tickets">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Novo Chamado</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para abrir um chamado de suporte
          </p>
        </div>
        <StepIndicator current={step} total={2} />
      </div>

      {/* SLA warning */}
      <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 px-4 py-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-yellow-800 dark:text-yellow-200">
          <span className="font-semibold">Atenção:</span> informações
          incompletas ou incorretas podem impactar o SLA do chamado.
        </p>
      </div>

      {availableSectors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div
              className="text-center py-8 text-muted-foreground"
              data-testid="text-no-sector"
            >
              Usuário sem setor vinculado. Não é possível abrir chamados.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── PASSO 1: Categoria ──────────────────────────────────────────── */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Passo 1 — Selecione a categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category search */}
                <div className="space-y-2">
                  <Label>Buscar categoria</Label>
                  <div className="relative">
                    <Input
                      placeholder="Digite para filtrar categorias..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      data-testid="input-category-search"
                    />
                  </div>
                </div>

                {/* Category select */}
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoria</Label>
                  <Select value={categoryId} onValueChange={handleCategoryChange}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorySearch.trim() ? (
                        filteredCategories.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Nenhuma categoria encontrada
                          </div>
                        ) : (
                          filteredCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )
                      ) : (
                        categories.map((root) => (
                          <SelectGroup key={root.id}>
                            <SelectLabel>{root.name}</SelectLabel>
                            {root.children && root.children.length > 0 ? (
                              root.children.map((child) => (
                                <SelectItem key={child.id} value={child.id}>
                                  {child.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value={root.id}>
                                {root.name}
                              </SelectItem>
                            )}
                          </SelectGroup>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* KB suggestions */}
                {categoryId && kbSuggestions.length > 0 && (
                  <Card className="border-chart-1/30 bg-chart-1/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="h-4 w-4 text-chart-1" />
                        <span className="text-sm font-medium">
                          Artigos que podem ajudar
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {kbSuggestions.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {kbSuggestions.slice(0, 3).map((article) => (
                          <a
                            key={article.id}
                            href={`/api/kb/${article.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 hover-elevate cursor-pointer"
                            data-testid={`kb-suggestion-${article.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {article.title}
                              </p>
                              {article.helpfulCount !== undefined &&
                                article.helpfulCount > 0 && (
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
                      <p className="text-xs text-muted-foreground mt-3">
                        Verifique se algum desses artigos resolve sua dúvida antes de abrir o chamado.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!canProceedStep1}
                    data-testid="button-next-step"
                  >
                    Próximo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── PASSO 2: Formulário ─────────────────────────────────────────── */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Passo 2 — Detalhes do chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Sector */}
                  {availableSectors.length === 1 ? (
                    <div className="space-y-2">
                      <Label>Setor Solicitante</Label>
                      <p
                        className="text-sm font-medium px-3 py-2 border rounded-md bg-muted"
                        data-testid="text-sector-auto"
                      >
                        {availableSectors[0].name}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="requesterSectorId">Setor Solicitante</Label>
                      <Select
                        value={requesterSectorId}
                        onValueChange={setRequesterSectorId}
                      >
                        <SelectTrigger data-testid="select-sector">
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSectors.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Selected category (read-only summary) */}
                  <div className="space-y-2">
                    <Label>Categoria selecionada</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted text-sm">
                      <span className="font-medium">{selectedCategory?.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => setStep(1)}
                      >
                        Alterar
                      </Button>
                    </div>
                  </div>

                  {/* Priority */}
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

                  {/* Dynamic form schema */}
                  {selectedFormSchema.length > 0 && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-medium">Dados do serviço</p>
                        {selectedFormSchema.map((field) => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-sm">
                              {field.label}
                              {field.required && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </Label>
                            {field.helpText && (
                              <p className="text-xs text-muted-foreground">
                                {field.helpText}
                              </p>
                            )}
                            {field.type === "textarea" ? (
                              <Textarea
                                value={requestData[field.key] || ""}
                                onChange={(e) =>
                                  setRequestData((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder}
                                rows={3}
                                data-testid={`field-${field.key}`}
                              />
                            ) : field.type === "select" && field.options ? (
                              <Select
                                value={requestData[field.key] || ""}
                                onValueChange={(v) =>
                                  setRequestData((prev) => ({
                                    ...prev,
                                    [field.key]: v,
                                  }))
                                }
                              >
                                <SelectTrigger
                                  data-testid={`field-${field.key}`}
                                >
                                  <SelectValue
                                    placeholder={
                                      field.placeholder || "Selecione..."
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={
                                  field.type === "email"
                                    ? "email"
                                    : field.type === "number"
                                    ? "number"
                                    : "text"
                                }
                                value={requestData[field.key] || ""}
                                onChange={(e) =>
                                  setRequestData((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }
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
                                {field.rules.minLen && (
                                  <span>Mín. {field.rules.minLen} chars</span>
                                )}
                                {field.rules.maxLen && (
                                  <span>Máx. {field.rules.maxLen} chars</span>
                                )}
                                {field.rules.min !== undefined && (
                                  <span>Mín. {field.rules.min}</span>
                                )}
                                {field.rules.max !== undefined && (
                                  <span>Máx. {field.rules.max}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Required attachments info */}
                  {selectedRequiredAttachments.length > 0 && (
                    <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-orange-600" />
                          <p className="text-sm font-medium">
                            Anexos necessários
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Os anexos abaixo devem ser enviados após a criação do
                          chamado.
                        </p>
                        <div className="space-y-1">
                          {selectedRequiredAttachments.map((att) => (
                            <div
                              key={att.key}
                              className="flex items-center gap-2 text-sm"
                              data-testid={`required-att-${att.key}`}
                            >
                              <Badge
                                variant={att.required ? "destructive" : "outline"}
                                className="text-[10px]"
                              >
                                {att.required ? "obrigatório" : "opcional"}
                              </Badge>
                              <span>{att.label}</span>
                              {att.mime && att.mime.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({att.mime.join(", ")})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Title */}
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

                  {/* Description */}
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
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setStep(1)}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending || !canSubmit
                      }
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
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Template replace dialog */}
      <AlertDialog open={showTemplateConfirm} onOpenChange={setShowTemplateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir descrição?</AlertDialogTitle>
            <AlertDialogDescription>
              A descrição atual será substituída pelo template da categoria.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDescription(pendingTemplate.current);
                setShowTemplateConfirm(false);
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

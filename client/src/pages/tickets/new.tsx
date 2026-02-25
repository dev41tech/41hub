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
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Sector, TicketCategoryTree } from "@shared/schema";

export default function TicketsNew() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterSectorId, setRequesterSectorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const pendingTemplate = useRef("");

  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["/api/admin/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sectors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<TicketCategoryTree[]>({
    queryKey: ["/api/tickets/categories"],
  });

  const availableSectors = user?.isAdmin
    ? sectors
    : sectors.filter(s =>
        user?.roles?.some(r => r.sectorId === s.id && (r.roleName === "Coordenador"))
      );

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
    const cat = allCategories.find(c => c.id === newCategoryId);
    const template = (cat as any)?.descriptionTemplate || "";
    if (template) {
      if (!description.trim()) {
        setDescription(template);
      }
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
      const sectorId = requesterSectorId || (availableSectors.length === 1 ? availableSectors[0].id : "");
      const res = await apiRequest("POST", "/api/tickets", {
        title,
        description,
        requesterSectorId: sectorId,
        categoryId,
        priority,
      });
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

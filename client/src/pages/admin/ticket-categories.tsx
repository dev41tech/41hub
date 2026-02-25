import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Loader2, FolderTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TicketCategory } from "@shared/schema";

type DialogMode = "branch" | "subcategory" | "edit";

export default function AdminTicketCategories(props: { embedded?: boolean } & Record<string, any>) {
  const embedded = props.embedded ?? false;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("branch");
  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [descriptionTemplate, setDescriptionTemplate] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data: categories = [], isLoading } = useQuery<TicketCategory[]>({
    queryKey: ["/api/admin/tickets/categories"],
  });

  const roots = categories.filter(c => !c.parentId);
  const activeRoots = roots.filter(r => r.isActive);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name,
        descriptionTemplate: descriptionTemplate || null,
      };

      if (editing) {
        if (editing.parentId) {
          payload.parentId = parentId === "none" ? null : parentId;
          const parent = parentId !== "none" ? categories.find(c => c.id === parentId) : null;
          if (parent) payload.branch = parent.branch;
        }
        return (await apiRequest("PATCH", `/api/admin/tickets/categories/${editing.id}`, payload)).json();
      }

      if (dialogMode === "branch") {
        payload.branch = name;
        payload.parentId = null;
      } else {
        const parent = categories.find(c => c.id === parentId);
        payload.branch = parent?.branch || name;
        payload.parentId = parentId === "none" ? null : parentId;
      }
      return (await apiRequest("POST", "/api/admin/tickets/categories", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/categories"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Categoria atualizada" : "Categoria criada" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return (await apiRequest("PATCH", `/api/admin/tickets/categories/${id}`, { isActive })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/categories"] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setEditing(null);
    setName("");
    setBranch("");
    setParentId("none");
    setDescriptionTemplate("");
  }

  function openCreateBranch() {
    resetForm();
    setDialogMode("branch");
    setDialogOpen(true);
  }

  function openCreateSubcategory() {
    resetForm();
    setDialogMode("subcategory");
    if (activeRoots.length === 1) {
      setParentId(activeRoots[0].id);
    }
    setDialogOpen(true);
  }

  function openEdit(cat: TicketCategory) {
    setEditing(cat);
    setDialogMode("edit");
    setName(cat.name);
    setBranch(cat.branch);
    setParentId(cat.parentId || "none");
    setDescriptionTemplate(cat.descriptionTemplate || "");
    setDialogOpen(true);
  }

  const filteredCategories = showInactive
    ? categories
    : categories.filter(c => c.isActive);

  const sortedCategories = [...filteredCategories].sort((a, b) => {
    const aIsRoot = !a.parentId;
    const bIsRoot = !b.parentId;

    if (aIsRoot && bIsRoot) return a.name.localeCompare(b.name);

    const rootA = aIsRoot ? a : categories.find(c => c.id === a.parentId);
    const rootB = bIsRoot ? b : categories.find(c => c.id === b.parentId);

    const rootNameA = rootA?.name || "";
    const rootNameB = rootB?.name || "";
    const rootCmp = rootNameA.localeCompare(rootNameB);
    if (rootCmp !== 0) return rootCmp;

    if (aIsRoot) return -1;
    if (bIsRoot) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-6 p-6"}>
      {!embedded && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FolderTree className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Categorias de Chamados</h1>
            <p className="text-sm text-muted-foreground">Gerenciar branches e subcategorias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openCreateBranch} data-testid="button-new-branch">
            <Plus className="mr-2 h-4 w-4" />
            Nova Branch
          </Button>
          <Button onClick={openCreateSubcategory} data-testid="button-new-subcategory">
            <Plus className="mr-2 h-4 w-4" />
            Nova Subcategoria
          </Button>
        </div>
      </div>
      )}
      {embedded && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={openCreateBranch} data-testid="button-new-branch">
            <Plus className="mr-2 h-4 w-4" />
            Nova Branch
          </Button>
          <Button onClick={openCreateSubcategory} data-testid="button-new-subcategory">
            <Plus className="mr-2 h-4 w-4" />
            Nova Subcategoria
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-end gap-2 mb-4">
            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
              Mostrar inativas
            </Label>
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
              data-testid="switch-show-inactive"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma categoria encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map(cat => {
                  const isRoot = !cat.parentId;
                  return (
                    <TableRow key={cat.id} className={!cat.isActive ? "opacity-60" : ""} data-testid={`category-${cat.id}`}>
                      <TableCell className={isRoot ? "font-semibold" : "pl-8"}>
                        {isRoot ? (
                          <span className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-primary" />
                            {cat.name}
                          </span>
                        ) : (
                          <>└ {cat.name}</>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{isRoot ? "Branch" : "Subcategoria"}</Badge>
                      </TableCell>
                      <TableCell>
                        {cat.descriptionTemplate ? (
                          <Badge variant="secondary" className="text-xs">Sim</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.isActive ? "default" : "secondary"}>
                          {cat.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)} data-testid={`edit-${cat.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {cat.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({ id: cat.id, isActive: false })}
                            data-testid={`deactivate-${cat.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({ id: cat.id, isActive: true })}
                            data-testid={`reactivate-${cat.id}`}
                          >
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Editar Categoria"
                : dialogMode === "branch"
                ? "Nova Branch"
                : "Nova Subcategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-category-name" />
            </div>

            {dialogMode === "subcategory" && !editing && (
              <div className="space-y-2">
                <Label>Branch (pai)</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger data-testid="select-parent">
                    <SelectValue placeholder="Selecione a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRoots.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editing && editing.parentId && (
              <div className="space-y-2">
                <Label>Branch (pai)</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger data-testid="select-parent">
                    <SelectValue placeholder="Selecione a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {roots.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Template de Descrição (opcional)</Label>
              <Textarea
                value={descriptionTemplate}
                onChange={(e) => setDescriptionTemplate(e.target.value)}
                placeholder="Template que será preenchido automaticamente ao selecionar esta categoria..."
                rows={4}
                data-testid="input-description-template"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name || saveMutation.isPending || (dialogMode === "subcategory" && !editing && parentId === "none")}
              data-testid="button-save-category"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

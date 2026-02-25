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
  const [formFields, setFormFields] = useState<Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>>([]);
  const [templateApplyMode, setTemplateApplyMode] = useState("replace_if_empty");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [showAddField, setShowAddField] = useState(false);

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
          payload.formSchema = formFields.length > 0 ? formFields : null;
          payload.templateApplyMode = templateApplyMode;
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
    setFormFields([]);
    setTemplateApplyMode("replace_if_empty");
    setShowAddField(false);
    setNewFieldKey("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldOptions("");
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
    setFormFields(((cat as any).formSchema || []).map((f: any) => ({ ...f, required: f.required ?? false })));
    setTemplateApplyMode((cat as any).templateApplyMode || "replace_if_empty");
    setShowAddField(false);
    setDialogOpen(true);
  }

  function addFormField() {
    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
    setFormFields(prev => [
      ...prev,
      {
        key: newFieldKey.trim(),
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: newFieldRequired,
        ...(newFieldType === "select" && newFieldOptions.trim()
          ? { options: newFieldOptions.split(",").map(o => o.trim()).filter(Boolean) }
          : {}),
      },
    ]);
    setNewFieldKey("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldOptions("");
    setShowAddField(false);
  }

  function removeFormField(key: string) {
    setFormFields(prev => prev.filter(f => f.key !== key));
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
                  <TableHead>Formulário</TableHead>
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
                        {(cat as any).formSchema && (cat as any).formSchema.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">{(cat as any).formSchema.length} campos</Badge>
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

            {((editing && editing.parentId) || dialogMode === "subcategory") && (
              <>
                <div className="space-y-2">
                  <Label>Modo do template</Label>
                  <Select value={templateApplyMode} onValueChange={setTemplateApplyMode}>
                    <SelectTrigger data-testid="select-template-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replace_if_empty">Substituir se vazio</SelectItem>
                      <SelectItem value="always_replace">Substituir sempre</SelectItem>
                      <SelectItem value="append">Concatenar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Formulário da categoria</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddField(!showAddField)} data-testid="button-toggle-add-field">
                      <Plus className="h-3 w-3 mr-1" />
                      Campo
                    </Button>
                  </div>

                  {formFields.length > 0 && (
                    <div className="space-y-1">
                      {formFields.map(f => (
                        <div key={f.key} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                          <div>
                            <span className="font-medium">{f.label}</span>
                            <span className="text-muted-foreground ml-1">({f.type})</span>
                            {f.required && <Badge variant="destructive" className="ml-1 text-xs">obr.</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFormField(f.key)} data-testid={`remove-field-${f.key}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showAddField && (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/50">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Chave</Label>
                          <Input value={newFieldKey} onChange={e => setNewFieldKey(e.target.value)} placeholder="nome_campo" className="h-8" data-testid="input-field-key" />
                        </div>
                        <div>
                          <Label className="text-xs">Rótulo</Label>
                          <Input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="Nome do Campo" className="h-8" data-testid="input-field-label" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select value={newFieldType} onValueChange={setNewFieldType}>
                            <SelectTrigger className="h-8" data-testid="select-field-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Texto</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="number">Número</SelectItem>
                              <SelectItem value="textarea">Texto longo</SelectItem>
                              <SelectItem value="select">Seleção</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer pb-2">
                            <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
                            Obrigatório
                          </label>
                        </div>
                      </div>
                      {newFieldType === "select" && (
                        <div>
                          <Label className="text-xs">Opções (separar por vírgula)</Label>
                          <Input value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="Opção 1, Opção 2, Opção 3" className="h-8" data-testid="input-field-options" />
                        </div>
                      )}
                      <Button type="button" size="sm" onClick={addFormField} disabled={!newFieldKey.trim() || !newFieldLabel.trim()} data-testid="button-add-field">
                        Adicionar campo
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
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

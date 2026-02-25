import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, FolderTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TicketCategory } from "@shared/schema";

export default function AdminTicketCategories() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState<string>("INFRA");
  const [parentId, setParentId] = useState<string>("none");

  const { data: categories = [], isLoading } = useQuery<TicketCategory[]>({
    queryKey: ["/api/admin/tickets/categories"],
  });

  const roots = categories.filter(c => !c.parentId);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return (await apiRequest("PATCH", `/api/admin/tickets/categories/${editing.id}`, {
          name, branch, parentId: parentId === "none" ? null : parentId,
        })).json();
      }
      return (await apiRequest("POST", "/api/admin/tickets/categories", {
        name, branch, parentId: parentId === "none" ? null : parentId,
      })).json();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tickets/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/categories"] });
      toast({ title: "Categoria desativada" });
    },
  });

  function resetForm() {
    setEditing(null);
    setName("");
    setBranch("INFRA");
    setParentId("none");
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(cat: TicketCategory) {
    setEditing(cat);
    setName(cat.name);
    setBranch(cat.branch);
    setParentId(cat.parentId || "none");
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
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
            <p className="text-sm text-muted-foreground">Gerenciar categorias e subcategorias</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-new-category">
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(cat => (
                  <TableRow key={cat.id} data-testid={`category-${cat.id}`}>
                    <TableCell className={cat.parentId ? "pl-8" : "font-medium"}>
                      {cat.parentId ? "└ " : ""}{cat.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cat.branch}</Badge>
                    </TableCell>
                    <TableCell>{cat.parentId ? "Subcategoria" : "Raiz"}</TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive ? "default" : "secondary"}>
                        {cat.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cat)} data-testid={`edit-${cat.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {cat.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(cat.id)}
                          data-testid={`delete-${cat.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-category-name" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger data-testid="select-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFRA">Infra</SelectItem>
                  <SelectItem value="DEV">Dev</SelectItem>
                  <SelectItem value="SUPORTE">Suporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria Pai (opcional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger data-testid="select-parent">
                  <SelectValue placeholder="Nenhuma (raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                  {roots.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || createMutation.isPending}
              data-testid="button-save-category"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

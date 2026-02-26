import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Plus, Pencil, Loader2, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TicketSlaPolicy } from "@shared/schema";

const priorityLabels: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function AdminTicketSlaPolicies(props: { embedded?: boolean } & Record<string, any>) {
  const embedded = props.embedded ?? false;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TicketSlaPolicy | null>(null);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [firstResponseMinutes, setFirstResponseMinutes] = useState("");
  const [resolutionMinutes, setResolutionMinutes] = useState("");

  const { data: policies = [], isLoading } = useQuery<TicketSlaPolicy[]>({
    queryKey: ["/api/admin/tickets/sla-policies"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        priority,
        firstResponseMinutes: parseInt(firstResponseMinutes),
        resolutionMinutes: parseInt(resolutionMinutes),
      };
      if (editing) {
        return (await apiRequest("PATCH", `/api/admin/tickets/sla-policies/${editing.id}`, payload)).json();
      }
      return (await apiRequest("POST", "/api/admin/tickets/sla-policies", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets/sla-policies"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Política atualizada" : "Política criada" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setEditing(null);
    setName("");
    setPriority("MEDIA");
    setFirstResponseMinutes("");
    setResolutionMinutes("");
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p: TicketSlaPolicy) {
    setEditing(p);
    setName(p.name);
    setPriority(p.priority);
    setFirstResponseMinutes(String(p.firstResponseMinutes));
    setResolutionMinutes(String(p.resolutionMinutes));
    setDialogOpen(true);
  }

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
            <Timer className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Políticas SLA</h1>
            <p className="text-sm text-muted-foreground">Gerenciar SLAs por prioridade</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-new-sla">
          <Plus className="mr-2 h-4 w-4" />
          Nova Política
        </Button>
      </div>
      )}
      {embedded && (
        <div className="flex items-center justify-end">
          <Button onClick={openCreate} data-testid="button-new-sla">
            <Plus className="mr-2 h-4 w-4" />
            Nova Política
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Primeira Resposta</TableHead>
                  <TableHead>Resolução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map(p => (
                  <TableRow key={p.id} data-testid={`sla-${p.id}`}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{priorityLabels[p.priority]}</Badge>
                    </TableCell>
                    <TableCell>{formatMinutes(p.firstResponseMinutes)}</TableCell>
                    <TableCell>{formatMinutes(p.resolutionMinutes)}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`edit-sla-${p.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{editing ? "Editar Política SLA" : "Nova Política SLA"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-sla-name" />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-sla-priority">
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
              <Label>Primeira Resposta (minutos)</Label>
              <Input
                type="number"
                value={firstResponseMinutes}
                onChange={(e) => setFirstResponseMinutes(e.target.value)}
                data-testid="input-first-response"
              />
            </div>
            <div className="space-y-2">
              <Label>Resolução (minutos)</Label>
              <Input
                type="number"
                value={resolutionMinutes}
                onChange={(e) => setResolutionMinutes(e.target.value)}
                data-testid="input-resolution"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name || !firstResponseMinutes || !resolutionMinutes || saveMutation.isPending}
              data-testid="button-save-sla"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

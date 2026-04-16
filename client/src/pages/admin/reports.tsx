import { useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Bell,
  Layout,
  Calendar,
  Loader2,
  Package,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

async function downloadReport(url: string, filename: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = "Falha ao gerar relatório";
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default function AdminReports() {
  const { toast } = useToast();
  const [ticketFrom, setTicketFrom] = useState("");
  const [ticketTo, setTicketTo] = useState("");
  const [notifFrom, setNotifFrom] = useState("");
  const [notifTo, setNotifTo] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (type: string, format: "csv" | "json") => {
    const key = `${type}-${format}`;
    setLoading(key);
    try {
      let url = `/api/admin/reports/${type}?format=${format}`;
      if (type === "tickets") {
        if (ticketFrom) url += `&from=${ticketFrom}`;
        if (ticketTo) url += `&to=${ticketTo}`;
      }
      if (type === "notifications") {
        if (notifFrom) url += `&from=${notifFrom}`;
        if (notifTo) url += `&to=${notifTo}`;
      }
      if (type === "resources" && includeInactive) {
        url += `&includeInactive=true`;
      }
      const ext = format === "csv" ? "csv" : "json";
      await downloadReport(url, `${type}_report.${ext}`);
      toast({ title: "Exportado com sucesso", description: `Relatório de ${type} baixado.` });
    } catch (err: any) {
      toast({
        title: "Falha ao exportar",
        description: err?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  function DateRangeRow({
    fromValue, onFromChange, toValue, onToChange,
    fromId, toId,
  }: {
    fromValue: string; onFromChange: (v: string) => void;
    toValue: string; onToChange: (v: string) => void;
    fromId: string; toId: string;
  }) {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={fromId} className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> De
          </Label>
          <Input
            id={fromId}
            type="date"
            value={fromValue}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-40"
            data-testid={`input-${fromId}`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={toId} className="text-xs text-muted-foreground">Até</Label>
          <Input
            id={toId}
            type="date"
            value={toValue}
            onChange={(e) => onToChange(e.target.value)}
            className="w-40"
            data-testid={`input-${toId}`}
          />
        </div>
      </div>
    );
  }

  function ExportButtons({ type, loadingKey }: { type: string; loadingKey: string }) {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport(type, "csv")}
          disabled={loading === `${type}-csv`}
          data-testid={`button-export-${loadingKey}-csv`}
        >
          {loading === `${type}-csv` ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport(type, "json")}
          disabled={loading === `${type}-json`}
          data-testid={`button-export-${loadingKey}-json`}
        >
          {loading === `${type}-json` ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          JSON
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10 shrink-0">
          <Download className="h-5 w-5 text-chart-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-reports-title">
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Exporte dados do sistema em CSV ou JSON
          </p>
        </div>
      </div>

      {/* Chamados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Chamados
          </CardTitle>
          <CardDescription>
            Exporta todos os chamados com status, prioridade, categoria e SLA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangeRow
            fromValue={ticketFrom} onFromChange={setTicketFrom}
            toValue={ticketTo} onToChange={setTicketTo}
            fromId="ticket-from" toId="ticket-to"
          />
          <ExportButtons type="tickets" loadingKey="tickets" />
        </CardContent>
      </Card>

      {/* Recursos / Apps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Recursos / Apps
          </CardTitle>
          <CardDescription>
            Exporta apps e dashboards cadastrados, com setor e status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
              data-testid="switch-include-inactive"
            />
            <Label htmlFor="include-inactive" className="text-sm cursor-pointer">
              Incluir inativos
            </Label>
          </div>
          <ExportButtons type="resources" loadingKey="resources" />
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notificações
          </CardTitle>
          <CardDescription>
            Exporta notificações enviadas, com destinatário e status de leitura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangeRow
            fromValue={notifFrom} onFromChange={setNotifFrom}
            toValue={notifTo} onToChange={setNotifTo}
            fromId="notif-from" toId="notif-to"
          />
          <ExportButtons type="notifications" loadingKey="notif" />
        </CardContent>
      </Card>
    </div>
  );
}

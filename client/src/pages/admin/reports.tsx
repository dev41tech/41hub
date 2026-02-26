import { useState } from "react";
import { ArrowLeft, Download, FileText, Bell, Layout, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

async function downloadReport(url: string, filename: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao gerar relatório");
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
      const ext = format === "csv" ? "csv" : "json";
      await downloadReport(url, `${type}_report.${ext}`);
      toast({ title: "Exportado", description: `Relatório de ${type} baixado com sucesso.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao exportar relatório.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10">
          <Download className="h-5 w-5 text-chart-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-reports-title">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Exporte dados em CSV ou JSON</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <FileText className="h-4 w-4" />
              Chamados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={ticketFrom}
                  onChange={(e) => setTicketFrom(e.target.value)}
                  className="w-40"
                  data-testid="input-ticket-from"
                />
              </div>
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={ticketTo}
                onChange={(e) => setTicketTo(e.target.value)}
                className="w-40"
                data-testid="input-ticket-to"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport("tickets", "csv")}
                disabled={loading === "tickets-csv"}
                data-testid="button-export-tickets-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("tickets", "json")}
                disabled={loading === "tickets-json"}
                data-testid="button-export-tickets-json"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Layout className="h-4 w-4" />
              Recursos / Apps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport("resources", "csv")}
                disabled={loading === "resources-csv"}
                data-testid="button-export-resources-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("resources", "json")}
                disabled={loading === "resources-json"}
                data-testid="button-export-resources-json"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Bell className="h-4 w-4" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={notifFrom}
                  onChange={(e) => setNotifFrom(e.target.value)}
                  className="w-40"
                  data-testid="input-notif-from"
                />
              </div>
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={notifTo}
                onChange={(e) => setNotifTo(e.target.value)}
                className="w-40"
                data-testid="input-notif-to"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport("notifications", "csv")}
                disabled={loading === "notifications-csv"}
                data-testid="button-export-notif-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("notifications", "json")}
                disabled={loading === "notifications-json"}
                data-testid="button-export-notif-json"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

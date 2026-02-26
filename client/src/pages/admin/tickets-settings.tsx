import { ArrowLeft, Settings } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminTicketCategories from "./ticket-categories";
import AdminTicketSlaPolicies from "./ticket-sla";

export default function AdminTicketsSettings() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back-tickets-settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Config Chamados</h1>
          <p className="text-sm text-muted-foreground">
            Categorias e políticas de SLA
          </p>
        </div>
      </div>

      <Tabs defaultValue="categories" data-testid="tabs-tickets-settings">
        <TabsList>
          <TabsTrigger value="categories" data-testid="tab-categories">Categorias</TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-sla">SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesContent />
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <SlaContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesContent() {
  return <AdminTicketCategories embedded />;
}

function SlaContent() {
  return <AdminTicketSlaPolicies embedded />;
}

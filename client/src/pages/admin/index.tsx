import { useLocation, Link } from "wouter";
import {
  Users,
  Building2,
  Layout,
  FileText,
  ChevronRight,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  users: number;
  sectors: number;
  resources: number;
  auditLogs: number;
}

const adminSections = [
  {
    title: "Setores",
    description: "Gerenciar setores da organização",
    icon: Building2,
    href: "/admin/sectors",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Usuários",
    description: "Gerenciar usuários e permissões",
    icon: Users,
    href: "/admin/users",
    color: "bg-chart-2/10 text-chart-2",
  },
  {
    title: "Recursos",
    description: "Gerenciar apps e dashboards",
    icon: Layout,
    href: "/admin/resources",
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    title: "Auditoria",
    description: "Visualizar logs de atividades",
    icon: FileText,
    href: "/admin/audit",
    color: "bg-chart-4/10 text-chart-4",
  },
];

export default function AdminIndex() {
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administração</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie setores, usuários e recursos do Hub
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.sectors || 0}</p>
              <p className="text-sm text-muted-foreground">Setores</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Users className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.users || 0}</p>
              <p className="text-sm text-muted-foreground">Usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
              <Layout className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.resources || 0}</p>
              <p className="text-sm text-muted-foreground">Recursos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <FileText className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats?.auditLogs || 0}</p>
              <p className="text-sm text-muted-foreground">Logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover-elevate cursor-pointer h-full" data-testid={`admin-section-${section.title.toLowerCase()}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${section.color}`}>
                  <section.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {section.description}
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

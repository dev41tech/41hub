import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Home,
  LayoutGrid,
  BarChart3,
  Star,
  Settings,
  LogOut,
  User,
  Ticket,
  Keyboard,
  ChevronRight,
  Users,
  FileText,
  Search,
  Puzzle,
  BarChart2,
  Package,
  Bell,
  LineChart,
  Database,
  ShieldAlert,
} from "lucide-react";
import { ThemeLogo } from "@/components/theme-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const adminSubItems = [
  { title: "Usuários", url: "/admin/users", icon: Users },
  { title: "Recursos", url: "/admin/resources", icon: Database },
  { title: "Config. Chamados", url: "/admin/tickets-settings", icon: FileText },
  { title: "Config. Digitação", url: "/admin/typing", icon: Keyboard },
  { title: "Integrações", url: "/admin/integrations", icon: Puzzle },
  { title: "Relatórios", url: "/admin/reports", icon: BarChart2 },
  { title: "Analytics", url: "/analytics", icon: LineChart },
  { title: "Auditoria", url: "/admin/audit", icon: Search },
];

const recursosSubItems = [
  { title: "Apps", url: "/apps", icon: LayoutGrid },
  { title: "Dashboards", url: "/dashboards", icon: BarChart3 },
  { title: "Favoritos", url: "/favorites", icon: Star },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const isAdmin = user?.isAdmin;

  const [recursosOpen, setRecursosOpen] = useState(
    ["/apps", "/dashboards", "/favorites"].some((p) => location.startsWith(p))
  );
  const [adminOpen, setAdminOpen] = useState(
    location.startsWith("/admin") || location.startsWith("/analytics")
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isAdminItemActive = (item: { url: string }) => {
    if (item.url === "/admin/tickets-settings") {
      return location === item.url || location.startsWith("/admin/tickets");
    }
    return location === item.url || location.startsWith(item.url + "/");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center justify-center">
          <ThemeLogo className="h-10 w-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Visão geral */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/"}
                  data-testid="nav-home"
                >
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Visão geral</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Recursos (collapsible) */}
              <Collapsible open={recursosOpen} onOpenChange={setRecursosOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={recursosSubItems.some((i) =>
                        location.startsWith(i.url)
                      )}
                      data-testid="nav-recursos"
                    >
                      <Package className="h-4 w-4" />
                      <span>Recursos</span>
                      <ChevronRight
                        className={`ml-auto h-4 w-4 transition-transform ${
                          recursosOpen ? "rotate-90" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {recursosSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.startsWith(item.url)}
                            data-testid={`nav-${item.title.toLowerCase()}`}
                          >
                            <Link href={item.url}>
                              <item.icon className="h-3.5 w-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Chamados */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/tickets")}
                  data-testid="nav-chamados"
                >
                  <Link href="/tickets">
                    <Ticket className="h-4 w-4" />
                    <span>Chamados</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Digitação */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/typing")}
                  data-testid="nav-digitação"
                >
                  <Link href="/typing">
                    <Keyboard className="h-4 w-4" />
                    <span>Digitação</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Alertas */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/alerts")}
                  data-testid="nav-alertas"
                >
                  <Link href="/alerts">
                    <Bell className="h-4 w-4" />
                    <span>Alertas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Perfil */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/profile")}
                  data-testid="nav-perfil"
                >
                  <Link href="/profile">
                    <User className="h-4 w-4" />
                    <span>Perfil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Admin submenu */}
              {isAdmin && (
                <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={
                          location.startsWith("/admin") ||
                          location.startsWith("/analytics")
                        }
                        data-testid="nav-admin"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Admin</span>
                        <ChevronRight
                          className={`ml-auto h-4 w-4 transition-transform ${
                            adminOpen ? "rotate-90" : ""
                          }`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {adminSubItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isAdminItemActive(item)}
                                  data-testid={`nav-admin-${item.title
                                    .toLowerCase()
                                    .replace(/[\s.]+/g, "-")}`}
                                >
                                  <Link href={item.url}>
                                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                      {item.title}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                {item.title}
                              </TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Alertas de Segurança - admin only shortcut */}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={false}
                    data-testid="nav-admin-alerts"
                  >
                    <Link href="/admin/alerts">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Avisos (Admin)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2 px-2"
                data-testid="button-user-menu"
              >
                <Avatar className="h-8 w-8">
                  {user.photoUrl && (
                    <AvatarImage src={user.photoUrl} alt={user.name} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left overflow-hidden">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {user.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {user.email}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <Link href="/profile">
                <DropdownMenuItem
                  data-testid="menu-profile"
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
                data-testid="menu-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="text-sm text-muted-foreground text-center">
            Não autenticado
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

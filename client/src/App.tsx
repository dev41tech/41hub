import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeLogo } from "@/components/theme-logo";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import LocalLogin from "@/pages/local-login";
import { PasswordChangeModal } from "@/components/password-change-modal";
import Home from "@/pages/home";
import Apps from "@/pages/apps";
import Dashboards from "@/pages/dashboards";
import Favorites from "@/pages/favorites";
import Profile from "@/pages/profile";
import ResourceViewer from "@/pages/resource-viewer";
import AdminIndex from "@/pages/admin/index";
import AdminSectors from "@/pages/admin/sectors";
import AdminUsers from "@/pages/admin/users";
import AdminResources from "@/pages/admin/resources";
import AdminAudit from "@/pages/admin/audit";
import AdminSettings from "@/pages/admin/settings";
import AdminTicketCategories from "@/pages/admin/ticket-categories";
import AdminTicketSlaPolicies from "@/pages/admin/ticket-sla";
import AdminTicketsSettings from "@/pages/admin/tickets-settings";
import AdminNotifications from "@/pages/admin/notifications";
import AdminKb from "@/pages/admin/kb";
import AdminTiDashboard from "@/pages/admin/ti-dashboard";
import AdminTyping from "@/pages/admin/typing";
import TicketsIndex from "@/pages/tickets/index";
import TicketsNew from "@/pages/tickets/new";
import TicketsDetail from "@/pages/tickets/detail";
import TypingTest from "@/pages/typing";
import TypingLeaderboard from "@/pages/typing-leaderboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/apps" component={Apps} />
      <Route path="/dashboards" component={Dashboards} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/profile" component={Profile} />
      <Route path="/resource/:id" component={ResourceViewer} />
      <Route path="/tickets" component={TicketsIndex} />
      <Route path="/tickets/new" component={TicketsNew} />
      <Route path="/tickets/:id" component={TicketsDetail} />
      <Route path="/typing" component={TypingTest} />
      <Route path="/typing/leaderboard" component={TypingLeaderboard} />
      <Route path="/admin" component={AdminIndex} />
      <Route path="/admin/sectors" component={AdminSectors} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/resources" component={AdminResources} />
      <Route path="/admin/audit" component={AdminAudit} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/tickets-settings" component={AdminTicketsSettings} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/kb" component={AdminKb} />
      <Route path="/admin/ti" component={AdminTiDashboard} />
      <Route path="/admin/typing" component={AdminTyping} />
      <Route path="/admin/tickets/categories" component={AdminTicketCategories} />
      <Route path="/admin/tickets/sla" component={AdminTicketSlaPolicies} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <ThemeLogo className="h-12 w-auto" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login/local" component={LocalLogin} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <>
      <PasswordChangeModal />
      <AuthenticatedLayout />
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

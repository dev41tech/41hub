import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Star, AlertCircle, Monitor, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { ResourceWithHealth } from "@shared/schema";

type OpenBehavior = "HUB_ONLY" | "NEW_TAB_ONLY" | "BOTH";

const getStatusColor = (status?: "UP" | "DEGRADED" | "DOWN") => {
  switch (status) {
    case "UP":
      return "bg-status-online";
    case "DEGRADED":
      return "bg-status-away";
    case "DOWN":
      return "bg-status-busy";
    default:
      return "bg-status-offline";
  }
};

const getStatusText = (status?: "UP" | "DEGRADED" | "DOWN") => {
  switch (status) {
    case "UP":
      return "Online";
    case "DEGRADED":
      return "Degradado";
    case "DOWN":
      return "Offline";
    default:
      return "Desconhecido";
  }
};

export default function ResourceViewer() {
  const [, params] = useRoute("/resource/:id");
  const [, setLocation] = useLocation();
  const resourceId = params?.id;

  const { data: resource, isLoading, error } = useQuery<ResourceWithHealth>({
    queryKey: ["/api/resources", resourceId],
    enabled: !!resourceId,
  });

  const recordAccessMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/resources/${resourceId}/access`);
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (isFavorite: boolean) => {
      if (isFavorite) {
        return apiRequest("POST", `/api/favorites/${resourceId}`);
      } else {
        return apiRequest("DELETE", `/api/favorites/${resourceId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const openBehavior = (resource?.openBehavior as OpenBehavior) || "BOTH";
  const hasOpenedInNewTab = useRef<string | null>(null);

  useEffect(() => {
    if (resource) {
      recordAccessMutation.mutate();
      
      // Auto-redirect to new tab if openBehavior is NEW_TAB_ONLY (once per resource)
      if (openBehavior === "NEW_TAB_ONLY" && resource.url && hasOpenedInNewTab.current !== resource.id) {
        hasOpenedInNewTab.current = resource.id;
        window.open(resource.url, "_blank");
      }
    }
  }, [resource?.id, openBehavior]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-4 p-4 border-b">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Recurso não encontrado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                O recurso solicitado não existe ou você não tem permissão para acessá-lo.
              </p>
            </div>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Voltar para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderNewTabOnlyMessage = () => (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-lg",
              resource.type === "APP"
                ? "bg-primary/10 text-primary"
                : "bg-chart-2/10 text-chart-2"
            )}
          >
            <ExternalLink className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{resource.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Este recurso foi aberto em uma nova aba
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open(resource.url!, "_blank")}
            data-testid="button-open-external"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (resource.healthStatus === "DOWN") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Recurso indisponível</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Este recurso está temporariamente fora do ar. Por favor, tente novamente mais tarde.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // NEW_TAB_ONLY: Show confirmation message for all embed modes
    if (openBehavior === "NEW_TAB_ONLY") {
      if (resource.url) {
        return renderNewTabOnlyMessage();
      }
      // NEW_TAB_ONLY without URL - show not configured message
      return (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Recurso não configurado</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Este recurso está configurado para abrir em nova aba, mas a URL não foi definida.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (resource.embedMode === "IFRAME" && resource.url) {
      return (
        <iframe
          src={`/api/proxy/${resource.id}`}
          className="w-full h-full border-0"
          title={resource.name}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      );
    }

    if (resource.embedMode === "POWERBI") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <Card className="max-w-lg w-full">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-chart-2/10">
                <svg className="h-8 w-8 text-chart-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zm-7-2h-2V9h2v8zm-4 0H6v-5h2v5zm8 0h-2V7h2v10z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Dashboard Power BI</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {resource.name}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                A integração completa do Power BI será configurada quando as credenciais estiverem disponíveis.
              </p>
              {resource.url && openBehavior !== "HUB_ONLY" && (
                <Button
                  variant="outline"
                  onClick={() => window.open(resource.url!, "_blank")}
                  data-testid="button-open-powerbi"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir no Power BI
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (resource.embedMode === "LINK" && resource.url) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <Card className="max-w-lg w-full">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-lg",
                  resource.type === "APP"
                    ? "bg-primary/10 text-primary"
                    : "bg-chart-2/10 text-chart-2"
                )}
              >
                {resource.type === "APP" ? (
                  <Monitor className="h-8 w-8" />
                ) : (
                  <Layout className="h-8 w-8" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{resource.name}</h2>
                {resource.sectorName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {resource.sectorName}
                  </p>
                )}
              </div>
              {openBehavior !== "HUB_ONLY" && (
                <Button
                  onClick={() => window.open(resource.url!, "_blank")}
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </Button>
              )}
              {openBehavior === "HUB_ONLY" && (
                <p className="text-xs text-muted-foreground">
                  Este recurso pode ser acessado apenas através do Hub
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Recurso não configurado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Este recurso ainda não foi configurado corretamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-medium truncate">{resource.name}</h1>
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  getStatusColor(resource.healthStatus)
                )}
              />
              <span className="text-xs text-muted-foreground">
                {getStatusText(resource.healthStatus)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {resource.tags && resource.tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {resource.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavoriteMutation.mutate(!resource.isFavorite)}
            data-testid="button-toggle-favorite"
          >
            <Star
              className={cn(
                "h-4 w-4",
                resource.isFavorite
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </Button>
          {resource.url && resource.embedMode !== "LINK" && openBehavior !== "HUB_ONLY" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(resource.url!, "_blank")}
              data-testid="button-open-new-tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-background">
        {renderContent()}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LayoutGrid, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { ResourceGrid } from "@/components/resource-grid";
import { RecentAccessSection } from "@/components/recent-access-section";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ResourceWithHealth } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources"],
  });

  const { data: recentResources = [], isLoading: recentLoading } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources/recent"],
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ resourceId, isFavorite }: { resourceId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return apiRequest("POST", `/api/favorites/${resourceId}`);
      } else {
        return apiRequest("DELETE", `/api/favorites/${resourceId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const query = searchQuery.toLowerCase();
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.tags?.some((t) => t.toLowerCase().includes(query)) ||
        r.sectorName?.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

  const appCount = resources.filter((r) => r.type === "APP").length;
  const dashboardCount = resources.filter((r) => r.type === "DASHBOARD").length;

  const handleOpenResource = (resource: ResourceWithHealth) => {
    setLocation(`/resource/${resource.id}`);
  };

  const handleToggleFavorite = (resourceId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ resourceId, isFavorite });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {user?.name?.split(" ")[0] || "Usuário"}
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao portal corporativo 41 Tech
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => setLocation("/apps")}
          data-testid="card-apps-summary"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <LayoutGrid className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{appCount}</p>
              <p className="text-sm text-muted-foreground">Aplicações</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => setLocation("/dashboards")}
          data-testid="card-dashboards-summary"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
              <BarChart3 className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{dashboardCount}</p>
              <p className="text-sm text-muted-foreground">Dashboards</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <RecentAccessSection
        resources={recentResources}
        isLoading={recentLoading}
        onOpen={handleOpenResource}
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-base font-medium">Todos os Recursos</CardTitle>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por nome ou tag..."
              className="sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ResourceGrid
            resources={filteredResources}
            isLoading={resourcesLoading}
            onOpen={handleOpenResource}
            onToggleFavorite={handleToggleFavorite}
            emptyMessage={
              searchQuery
                ? "Nenhum recurso encontrado para sua busca"
                : "Nenhum recurso disponível"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

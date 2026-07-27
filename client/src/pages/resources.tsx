import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LayoutGrid, Monitor, BarChart3 } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { ResourceGrid } from "@/components/resource-grid";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import type { ResourceWithHealth } from "@shared/schema";

type TypeFilter = "all" | "APP" | "DASHBOARD";

export default function Resources() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data: resources = [], isLoading } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources"],
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
    const byType = typeFilter === "all" ? resources : resources.filter((r) => r.type === typeFilter);
    if (!searchQuery.trim()) return byType;
    const query = searchQuery.toLowerCase();
    return byType.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.tags?.some((t) => t.toLowerCase().includes(query)) ||
        r.sectorName?.toLowerCase().includes(query)
    );
  }, [resources, searchQuery, typeFilter]);

  const handleOpenResource = (resource: ResourceWithHealth) => {
    setLocation(`/resource/${resource.id}`);
  };

  const handleToggleFavorite = (resourceId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ resourceId, isFavorite });
  };

  const emptyLabel = typeFilter === "APP" ? "aplicação" : typeFilter === "DASHBOARD" ? "dashboard" : "recurso";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <LayoutGrid className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recursos</h1>
          <p className="text-sm text-muted-foreground">
            Aplicações e dashboards internos
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col gap-4 p-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-resources-all">Todos</TabsTrigger>
                <TabsTrigger value="APP" data-testid="tab-resources-apps">
                  <Monitor className="h-3.5 w-3.5 mr-1.5" />
                  Apps
                </TabsTrigger>
                <TabsTrigger value="DASHBOARD" data-testid="tab-resources-dashboards">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  Dashboards
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar recursos..."
              className="sm:w-64"
            />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {isLoading ? "Carregando recursos…" : `${filteredResources.length} ${filteredResources.length !== 1 ? "recursos disponíveis" : "recurso disponível"}`}
          </p>
        </div>
        <div className="p-4" data-tutorial="resources-grid">
          <ResourceGrid
            resources={filteredResources}
            isLoading={isLoading}
            onOpen={handleOpenResource}
            onToggleFavorite={handleToggleFavorite}
            isAdmin={user?.isAdmin === true}
            showSector
            emptyMessage={
              searchQuery
                ? `Nenhum ${emptyLabel} encontrado para sua busca`
                : `Nenhum ${emptyLabel} disponível`
            }
          />
        </div>
      </div>
    </div>
  );
}

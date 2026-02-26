import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { ResourceGrid } from "@/components/resource-grid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ResourceWithHealth } from "@shared/schema";

export default function Apps() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

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
    const apps = resources.filter((r) => r.type === "APP");
    if (!searchQuery.trim()) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.tags?.some((t) => t.toLowerCase().includes(query)) ||
        r.sectorName?.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

  const handleOpenResource = (resource: ResourceWithHealth) => {
    setLocation(`/resource/${resource.id}`);
  };

  const handleToggleFavorite = (resourceId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ resourceId, isFavorite });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Monitor className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Aplicações</h1>
          <p className="text-sm text-muted-foreground">
            Sistemas e ferramentas internas
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-base font-medium">
              {filteredResources.length} aplicação{filteredResources.length !== 1 ? "ões" : ""} disponível{filteredResources.length !== 1 ? "eis" : ""}
            </CardTitle>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar aplicações..."
              className="sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ResourceGrid
            resources={filteredResources}
            isLoading={isLoading}
            onOpen={handleOpenResource}
            onToggleFavorite={handleToggleFavorite}
            emptyMessage={
              searchQuery
                ? "Nenhuma aplicação encontrada para sua busca"
                : "Nenhuma aplicação disponível"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

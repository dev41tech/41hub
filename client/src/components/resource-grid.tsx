import { ResourceCard } from "@/components/resource-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResourceWithHealth } from "@shared/schema";

interface ResourceGridProps {
  resources: ResourceWithHealth[];
  isLoading: boolean;
  onOpen: (resource: ResourceWithHealth) => void;
  onToggleFavorite: (resourceId: string, isFavorite: boolean) => void;
  showSector?: boolean;
  emptyMessage?: string;
}

export function ResourceGrid({
  resources,
  isLoading,
  onOpen,
  onToggleFavorite,
  showSector = true,
  emptyMessage = "Nenhum recurso encontrado",
}: ResourceGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resources.map((resource) => (
        <ResourceCard
          key={resource.id}
          resource={resource}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          showSector={showSector}
        />
      ))}
    </div>
  );
}

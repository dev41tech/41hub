import { Star, ExternalLink, Monitor, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResourceWithHealth } from "@shared/schema";
import { effectiveHealth } from "@shared/schema";
import * as LucideIcons from "lucide-react";

interface ResourceCardProps {
  resource: ResourceWithHealth;
  onOpen: (resource: ResourceWithHealth) => void;
  onToggleFavorite: (resourceId: string, isFavorite: boolean) => void;
  showSector?: boolean;
}

const getIcon = (iconName: string) => {
  const icons = LucideIcons as Record<string, React.ComponentType<{ className?: string }>>;
  const Icon = icons[iconName] || LucideIcons.Layout;
  return Icon;
};

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

const getStatusLabel = (status?: "UP" | "DEGRADED" | "DOWN") => {
  switch (status) {
    case "UP":
      return "Operacional";
    case "DEGRADED":
      return "Em manutenção";
    case "DOWN":
      return "Fora do ar";
    default:
      return "Desconhecido";
  }
};

export function ResourceCard({
  resource,
  onOpen,
  onToggleFavorite,
  showSector = true,
}: ResourceCardProps) {
  const Icon = getIcon(resource.icon || "Layout");
  const isApp = resource.type === "APP";
  const displayHealth = effectiveHealth(resource);
  const hasIssue = displayHealth === "DOWN" || displayHealth === "DEGRADED";

  const statusDot = (
    <div
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        getStatusColor(displayHealth)
      )}
    />
  );

  return (
    <Card
      className={cn(
        "group relative hover-elevate cursor-pointer transition-all duration-200",
        hasIssue && "border-amber-500/30"
      )}
      onClick={() => onOpen(resource)}
      data-testid={`card-resource-${resource.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                isApp ? "bg-primary/10 text-primary" : "bg-chart-2/10 text-chart-2"
              )}
            >
              {isApp ? (
                <Monitor className="h-6 w-6" />
              ) : (
                <BarChart3 className="h-6 w-6" />
              )}
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">
                  {resource.name}
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {statusDot}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px]">
                    <p className="font-medium">{getStatusLabel(displayHealth)}</p>
                    {resource.healthMessage && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {resource.healthMessage}
                      </p>
                    )}
                    {hasIssue && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ver alertas para mais detalhes.
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>

              {showSector && resource.sectorName && (
                <span className="text-xs text-muted-foreground truncate">
                  {resource.sectorName}
                </span>
              )}

              {hasIssue && (
                <Badge
                  variant={resource.healthStatus === "DOWN" ? "destructive" : "outline"}
                  className="text-xs w-fit mt-0.5"
                >
                  {getStatusLabel(displayHealth)}
                </Badge>
              )}

              {resource.tags && resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {resource.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs px-1.5 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {resource.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      +{resource.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(resource.id, !resource.isFavorite);
              }}
              data-testid={`button-favorite-${resource.id}`}
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(resource);
              }}
              data-testid={`button-open-${resource.id}`}
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

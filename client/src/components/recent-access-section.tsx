import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResourceWithHealth } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RecentAccessSectionProps {
  resources: ResourceWithHealth[];
  isLoading: boolean;
  onOpen: (resource: ResourceWithHealth) => void;
}

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

export function RecentAccessSection({
  resources,
  isLoading,
  onOpen,
}: RecentAccessSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Acessados Recentemente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-40 shrink-0 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (resources.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Acessados Recentemente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {resources.map((resource) => (
            <button
              key={resource.id}
              onClick={() => onOpen(resource)}
              className="flex items-center gap-3 shrink-0 rounded-lg border bg-card p-3 hover-elevate transition-all min-w-[160px]"
              data-testid={`recent-${resource.id}`}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md",
                  resource.type === "APP"
                    ? "bg-primary/10 text-primary"
                    : "bg-chart-2/10 text-chart-2"
                )}
              >
                {resource.type === "APP" ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col items-start text-left overflow-hidden">
                <span className="text-sm font-medium truncate max-w-[100px]">
                  {resource.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      getStatusColor(resource.healthStatus)
                    )}
                  />
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {resource.type}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

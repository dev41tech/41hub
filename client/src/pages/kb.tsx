import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/page-container";
import { BookOpen, Search, Eye, ThumbsUp, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import type { TicketCategory } from "@shared/schema";

interface KbArticleItem {
  id: string;
  title: string;
  body: string;
  categoryName?: string;
  authorName?: string;
  viewCount?: number;
  helpfulCount?: number;
  isPublished: boolean;
  updatedAt: string;
}

export default function Kb() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: articles = [], isLoading } = useQuery<KbArticleItem[]>({
    queryKey: ["/api/kb", filterCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory && filterCategory !== "all") params.set("categoryId", filterCategory);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/kb?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: categories = [] } = useQuery<TicketCategory[]>({
    queryKey: ["/api/admin/tickets/categories"],
    enabled: user?.isAdmin === true,
  });

  const leafCategories = categories.filter((c) => c.parentId !== null);

  return (
    <PageContainer className="flex flex-col gap-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
            <BookOpen className="h-5 w-5 text-chart-1" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">
              Artigos e guias para suporte
            </p>
          </div>
        </div>
        {user?.isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/kb")}>
            Gerenciar artigos
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {user?.isAdmin && leafCategories.length > 0 && (
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {leafCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum artigo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              className="hover-elevate cursor-pointer transition-all"
              onClick={() => setLocation(`/kb/articles/${article.id}`)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
                  <BookOpen className="h-4 w-4 text-chart-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{article.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {article.body.replace(/[#*`_\[\]]/g, "").slice(0, 120)}
                    {article.body.length > 120 ? "…" : ""}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {article.categoryName && (
                      <Badge variant="secondary" className="text-xs">
                        {article.categoryName}
                      </Badge>
                    )}
                    {article.viewCount !== undefined && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {article.viewCount}
                      </span>
                    )}
                    {article.helpfulCount !== undefined && article.helpfulCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                        {article.helpfulCount}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

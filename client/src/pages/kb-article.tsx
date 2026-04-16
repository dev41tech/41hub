import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Eye,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface KbArticleFull {
  id: string;
  title: string;
  body: string;
  categoryName?: string;
  authorName?: string;
  viewCount?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Very lightweight markdown → HTML renderer (no external deps) */
function renderMarkdown(md: string): string {
  return md
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr />")
    // Paragraphs (double newline)
    .replace(/\n{2,}/g, "</p><p>")
    // Single newlines → <br>
    .replace(/\n/g, "<br />");
}

export default function KbArticle() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: article, isLoading, isError } = useQuery<KbArticleFull>({
    queryKey: [`/api/kb/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/kb/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Artigo não encontrado");
      return res.json();
    },
    retry: false,
  });

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      apiRequest("POST", `/api/kb/${id}/feedback`, { helpful }),
    onSuccess: (_, helpful) => {
      toast({
        title: helpful ? "Obrigado pelo feedback positivo!" : "Feedback registrado",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/kb/${id}`] });
    },
    onError: () =>
      toast({ title: "Não foi possível registrar o feedback", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">Artigo não encontrado</p>
        <Button variant="outline" onClick={() => setLocation("/kb")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar à base de conhecimento
        </Button>
      </div>
    );
  }

  const html = renderMarkdown(article.body);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Back + admin edit */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/kb")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Base de Conhecimento
        </Button>
        {user?.isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admin/kb")}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar no Admin
          </Button>
        )}
      </div>

      {/* Article card */}
      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold leading-tight">{article.title}</h1>
              {!article.isPublished && (
                <Badge variant="outline" className="shrink-0">Rascunho</Badge>
              )}
            </div>

            {article.categoryName && (
              <Badge variant="secondary">{article.categoryName}</Badge>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              {article.authorName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {article.authorName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Atualizado em{" "}
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                  new Date(article.updatedAt)
                )}
              </span>
              {article.viewCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {article.viewCount} visualizações
                </span>
              )}
            </div>
          </div>

          {/* Body — rendered markdown */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground
              [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-5
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3
              [&_p]:mb-3 [&_p]:leading-relaxed
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
              [&_li]:mb-1
              [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
              [&_strong]:font-semibold
              [&_em]:italic
              [&_hr]:border-border [&_hr]:my-4"
            dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
          />

          {/* Feedback */}
          <div className="border-t pt-4 flex flex-col gap-3">
            <p className="text-sm font-medium">Este artigo foi útil?</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => feedbackMutation.mutate(true)}
                disabled={feedbackMutation.isPending}
                className="gap-2"
              >
                <ThumbsUp className="h-4 w-4" />
                Sim{article.helpfulCount ? ` (${article.helpfulCount})` : ""}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => feedbackMutation.mutate(false)}
                disabled={feedbackMutation.isPending}
                className="gap-2"
              >
                <ThumbsDown className="h-4 w-4" />
                Não{article.notHelpfulCount ? ` (${article.notHelpfulCount})` : ""}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  Trophy,
  Medal,
  ArrowLeft,
  Zap,
  Target,
  Keyboard,
} from "lucide-react";
import type { Sector } from "@shared/schema";

type Level = "easy" | "medium" | "hard" | "all";

const LEVEL_LABELS: Record<Level, string> = {
  easy: "Fácil",
  medium: "Média",
  hard: "Difícil",
  all: "Todas",
};

type LeaderboardEntry = {
  userId: string;
  userName: string;
  userPhoto: string | null;
  sectorName: string | null;
  wpm: number;
  accuracy: string;
  monthKey: string;
  level: string;
};

type PodiumEntry = {
  level: string;
  rank: number;
  userId: string;
  userName: string;
  userPhoto: string | null;
  wpm: number;
  accuracy: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getMonthOptions(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    months.push({ value: key, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

function getPreviousMonthKey(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

const RANK_BG: Record<number, string> = {
  1: "bg-yellow-500/10 border-yellow-500/30",
  2: "bg-gray-400/10 border-gray-400/30",
  3: "bg-amber-700/10 border-amber-700/30",
};

export default function TypingLeaderboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = getPreviousMonthKey();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedLevel, setSelectedLevel] = useState<Level>("all");
  const [podiumLevel, setPodiumLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [tab, setTab] = useState<"global" | "sector">("global");
  const [selectedSectorId, setSelectedSectorId] = useState<string>("all");

  const monthOptions = getMonthOptions();

  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["/api/sectors"],
    enabled: !!user,
  });

  const leaderboardParams = new URLSearchParams({ month: selectedMonth });
  if (tab === "sector" && selectedSectorId && selectedSectorId !== "all") {
    leaderboardParams.set("sectorId", selectedSectorId);
  }
  if (selectedLevel !== "all") {
    leaderboardParams.set("level", selectedLevel);
  }

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/typing/leaderboard", selectedMonth, selectedLevel, tab, selectedSectorId],
    queryFn: async () => {
      const res = await fetch(`/api/typing/leaderboard?${leaderboardParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: podiumAll = [] } = useQuery<PodiumEntry[]>({
    queryKey: ["/api/typing/podium", prevMonth],
    queryFn: async () => {
      const res = await fetch(`/api/typing/podium?month=${prevMonth}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const podiumByLevel = podiumAll.filter((p) => p.level === podiumLevel);
  const hasPodium = podiumAll.length > 0;

  if (!user) return null;

  return (
    <div className="max-w-4xl w-full mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/typing")} data-testid="button-back-typing">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-leaderboard-title">Ranking de Digitação</h1>
            <p className="text-sm text-muted-foreground">Melhores resultados mensais</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setLocation("/typing")} data-testid="button-go-test">
          <Keyboard className="h-4 w-4 mr-2" />
          Fazer Teste
        </Button>
      </div>

      {/* ── Pódio do mês anterior ────────────────────────────────── */}
      {hasPodium && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Trophy className="h-4 w-4" />
                Pódio — {monthOptions.find((m) => m.value === prevMonth)?.label ?? prevMonth}
              </CardTitle>
              <div className="flex gap-1">
                {(["easy", "medium", "hard"] as const).map((lv) => (
                  <Button
                    key={lv}
                    variant={podiumLevel === lv ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setPodiumLevel(lv)}
                  >
                    {LEVEL_LABELS[lv]}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {podiumByLevel.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum resultado para {LEVEL_LABELS[podiumLevel]} no mês anterior.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {podiumByLevel.map((entry) => (
                  <div
                    key={`${entry.level}-${entry.rank}`}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border ${RANK_BG[entry.rank] ?? "border"}`}
                  >
                    <div className="flex items-center gap-1">
                      {getRankIcon(entry.rank)}
                      <span className="text-xs font-semibold text-muted-foreground">
                        {entry.rank === 1 ? "1º lugar" : entry.rank === 2 ? "2º lugar" : "3º lugar"}
                      </span>
                    </div>
                    <Avatar className="h-10 w-10">
                      {entry.userPhoto && <AvatarImage src={entry.userPhoto} alt={entry.userName} />}
                      <AvatarFallback className="bg-muted text-xs">{getInitials(entry.userName)}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-sm text-center truncate max-w-full">{entry.userName}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold flex items-center gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        {entry.wpm} PPM
                      </span>
                      <span className="text-muted-foreground">
                        {Number(entry.accuracy).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Filtros ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]" data-testid="select-month">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Level tabs replacing old numeric difficulty select */}
        <div className="flex gap-1 border rounded-md p-1">
          {(["all", "easy", "medium", "hard"] as Level[]).map((lv) => (
            <Button
              key={lv}
              variant={selectedLevel === lv ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setSelectedLevel(lv)}
              data-testid={`btn-level-${lv}`}
            >
              {LEVEL_LABELS[lv]}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "global" | "sector")}>
        <TabsList>
          <TabsTrigger value="global" data-testid="tab-global">Global</TabsTrigger>
          <TabsTrigger value="sector" data-testid="tab-sector">Por Setor</TabsTrigger>
        </TabsList>

        <TabsContent value="sector" className="mt-4">
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger className="w-[220px]" data-testid="select-sector">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {tab === "global" ? "Ranking Global" : "Ranking por Setor"}
            {selectedLevel !== "all" && (
              <Badge variant="secondary" className="text-xs">{LEVEL_LABELS[selectedLevel]}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhum resultado neste período.
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-3 rounded-md ${
                    entry.userId === user.id ? "bg-primary/5 border border-primary/20" : "border"
                  }`}
                  data-testid={`leaderboard-entry-${index}`}
                >
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(index + 1)}
                  </div>
                  <Avatar className="h-9 w-9">
                    {entry.userPhoto && <AvatarImage src={entry.userPhoto} alt={entry.userName} />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {getInitials(entry.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {entry.userName}
                      {entry.userId === user.id && (
                        <span className="text-xs text-primary ml-2">(você)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {entry.sectorName && (
                        <span className="text-xs text-muted-foreground truncate">{entry.sectorName}</span>
                      )}
                      {selectedLevel === "all" && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                          {LEVEL_LABELS[entry.level as Level] ?? entry.level}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-sm flex items-center gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        {entry.wpm} PPM
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {Number(entry.accuracy).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

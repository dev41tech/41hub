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

type LeaderboardEntry = {
  userId: string;
  userName: string;
  userPhoto: string | null;
  sectorName: string | null;
  wpm: number;
  accuracy: string;
  monthKey: string;
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

function getRankIcon(index: number) {
  if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
  if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
}

export default function TypingLeaderboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
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
  if (selectedDifficulty !== "all") {
    leaderboardParams.set("difficulty", selectedDifficulty);
  }

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/typing/leaderboard", selectedMonth, selectedDifficulty, tab, selectedSectorId],
    queryFn: async () => {
      const res = await fetch(`/api/typing/leaderboard?${leaderboardParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

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
        <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
          <SelectTrigger className="w-[160px]" data-testid="select-difficulty">
            <SelectValue placeholder="Dificuldade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="1">Fácil</SelectItem>
            <SelectItem value="2">Média</SelectItem>
            <SelectItem value="3">Difícil</SelectItem>
          </SelectContent>
        </Select>
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
          <CardTitle className="text-base">
            {tab === "global" ? "Ranking Global" : "Ranking por Setor"}
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
                    {getRankIcon(index)}
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
                    {entry.sectorName && (
                      <p className="text-xs text-muted-foreground truncate">{entry.sectorName}</p>
                    )}
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

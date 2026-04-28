import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Keyboard,
  Play,
  RotateCcw,
  Trophy,
  Clock,
  Target,
  Zap,
  Loader2,
  HelpCircle,
  Square,
  ShieldAlert,
} from "lucide-react";
import type { TypingText, TypingSession, TypingScore } from "@shared/schema";

type SessionState = "idle" | "loading" | "ready" | "running" | "finished";
type Level = "easy" | "medium" | "hard";

const TIMER_DURATION = 60;

const LEVEL_LABELS: Record<Level, string> = {
  easy: "Fácil",
  medium: "Média",
  hard: "Difícil",
};

export default function TypingTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [state, setState] = useState<SessionState>("idle");
  const [level, setLevel] = useState<Level>("medium");
  const [session, setSession] = useState<TypingSession | null>(null);
  const [text, setText] = useState<TypingText | null>(null);
  const [typed, setTyped] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(TIMER_DURATION);
  const [result, setResult] = useState<{ wpm: number; accuracy: number; score?: TypingScore } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPerfRef = useRef<number | null>(null);

  // Anti-cheat telemetry
  const pasteAttemptsRef = useRef<number>(0);
  const maxDeltaCharsRef = useRef<number>(0);
  const prevTypedLenRef = useRef<number>(0);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/typing/session", { level });
      return res.json() as Promise<{ session: TypingSession; text: TypingText; level: Level }>;
    },
    onSuccess: (data) => {
      setSession(data.session);
      setText(data.text);
      setTyped("");
      startPerfRef.current = null;
      setRemainingSeconds(TIMER_DURATION);
      setResult(null);
      // Reset anti-cheat counters for new session
      pasteAttemptsRef.current = 0;
      maxDeltaCharsRef.current = 0;
      prevTypedLenRef.current = 0;
      setState("ready");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: (err: Error) => {
      const msg = err.message?.includes("Nenhum texto")
        ? err.message
        : "Nenhum texto disponível. Peça ao admin para cadastrar textos para este nível.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setState("idle");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string;
      nonce: string;
      wpm: number;
      accuracy: number;
      durationMs: number;
      typed: string;
      level: Level;
      pasteAttempts: number;
      maxDeltaChars: number;
    }) => {
      const res = await apiRequest("POST", "/api/typing/submit", data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Erro ao salvar resultado");
      }
      return res.json() as Promise<TypingScore>;
    },
    onSuccess: (score) => {
      setResult((prev) => prev ? { ...prev, score } : null);
    },
    onError: (err: Error) => {
      toast({
        title: "Resultado não salvo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStart = () => {
    setState("loading");
    startSessionMutation.mutate();
  };

  const calculateResults = useCallback(() => {
    if (!text || !startPerfRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationMs = performance.now() - startPerfRef.current;
    const durationMin = durationMs / 60000;
    const words = typed.trim().split(/\s+/).length;
    const wpm = durationMin > 0 ? Math.round(words / durationMin) : 0;

    let correct = 0;
    const maxLen = Math.max(typed.length, text.content.length);
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text.content[i]) correct++;
    }
    const accuracy = maxLen > 0 ? (correct / maxLen) * 100 : 0;

    setResult({ wpm: Math.min(wpm, 300), accuracy: Math.round(accuracy * 100) / 100 });
    setState("finished");

    if (session) {
      submitMutation.mutate({
        sessionId: session.id,
        nonce: session.nonce,
        wpm: Math.min(wpm, 300),
        accuracy: Math.round(accuracy * 100) / 100,
        durationMs: Math.round(durationMs),
        typed,
        level,
        pasteAttempts: pasteAttemptsRef.current,
        maxDeltaChars: maxDeltaCharsRef.current,
      });
    }
  }, [text, typed, session, level]);

  const handleInput = (value: string) => {
    if (state === "ready") {
      setState("running");
      startPerfRef.current = performance.now();
      setRemainingSeconds(TIMER_DURATION);
      const startPerf = startPerfRef.current;
      timerRef.current = setInterval(() => {
        const elapsedSec = (performance.now() - startPerf) / 1000;
        const remaining = Math.max(0, TIMER_DURATION - Math.floor(elapsedSec));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
        }
      }, 250);
    }

    if (state !== "ready" && state !== "running") return;

    // Anti-cheat: track max delta between consecutive key events
    const delta = Math.abs(value.length - prevTypedLenRef.current);
    if (delta > maxDeltaCharsRef.current) maxDeltaCharsRef.current = delta;
    prevTypedLenRef.current = value.length;

    setTyped(value);

    if (text && value.length >= text.content.length) {
      calculateResults();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    pasteAttemptsRef.current++;
    toast({
      title: "Colagem bloqueada",
      description: "Colar texto não é permitido no teste de digitação.",
      variant: "destructive",
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    if (state === "running" && remainingSeconds <= 0) {
      calculateResults();
    }
  }, [remainingSeconds, state, calculateResults]);

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState("idle");
    setSession(null);
    setText(null);
    setTyped("");
    startPerfRef.current = null;
    setRemainingSeconds(TIMER_DURATION);
    setResult(null);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const renderText = () => {
    if (!text) return null;
    const chars = text.content.split("");
    return (
      <div className="font-mono text-base leading-relaxed whitespace-pre-wrap break-words select-none p-4 rounded-md border bg-muted/30 min-h-[120px]">
        {chars.map((char, i) => {
          let className = "text-muted-foreground/50";
          if (i < typed.length) {
            className = typed[i] === char ? "text-green-600 dark:text-green-400" : "text-destructive bg-destructive/10";
          } else if (i === typed.length) {
            className = "text-foreground bg-primary/20 border-b-2 border-primary";
          }
          return (
            <span key={i} className={className}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Keyboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold" data-testid="text-typing-title">
                Teste de Digitação
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help" data-testid="tooltip-typing-help">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">Digitar bem economiza tempo, reduz erros e melhora sua produtividade no dia a dia. No trabalho com computador, pequenos ganhos de velocidade e precisão viram horas no mês.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-muted-foreground">
              Pratique e melhore sua velocidade
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation("/typing/leaderboard")}
          data-testid="button-leaderboard"
        >
          <Trophy className="h-4 w-4 mr-2" />
          Ranking
        </Button>
      </div>

      {state === "idle" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-6">
            <Keyboard className="h-16 w-16 text-muted-foreground/40" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Pronto para começar?</p>
              <p className="text-sm text-muted-foreground">
                Um texto aleatório será exibido. Digite-o o mais rápido possível em 60 segundos.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground">Dificuldade:</label>
                <Select
                  value={level}
                  onValueChange={(v) => setLevel(v as Level)}
                >
                  <SelectTrigger className="w-[140px]" data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                Colar texto é bloqueado e invalida o resultado
              </div>
              <Button
                onClick={handleStart}
                disabled={startSessionMutation.isPending}
                data-testid="button-start-test"
              >
                {startSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Iniciar Teste
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state === "loading" && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando texto...</p>
          </CardContent>
        </Card>
      )}

      {(state === "ready" || state === "running") && text && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Badge variant={remainingSeconds <= 10 ? "destructive" : "secondary"} data-testid="badge-countdown">
                <Clock className="h-3 w-3 mr-1" />
                {formatCountdown(remainingSeconds)}
              </Badge>
              <Badge variant="secondary">
                {typed.length} / {text.content.length} chars
              </Badge>
              <Badge variant="outline">
                {LEVEL_LABELS[level]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={calculateResults}
                disabled={state !== "running"}
                data-testid="button-finish-test"
              >
                <Square className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-test">
                <RotateCcw className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              {renderText()}
            </CardContent>
          </Card>

          <textarea
            ref={inputRef}
            value={typed}
            onChange={(e) => handleInput(e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            className="w-full p-4 rounded-md border bg-background font-mono text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
            placeholder={state === "ready" ? "Comece a digitar aqui..." : ""}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-testid="input-typing-area"
          />
        </div>
      )}

      {state === "finished" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Resultado
              <Badge variant="outline" className="ml-2">{LEVEL_LABELS[level]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-bold" data-testid="text-result-wpm">{result.wpm}</p>
                <p className="text-xs text-muted-foreground">PPM (palavras/min)</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Target className="h-5 w-5 mx-auto mb-2 text-green-500" />
                <p className="text-3xl font-bold" data-testid="text-result-accuracy">{result.accuracy}%</p>
                <p className="text-xs text-muted-foreground">Precisão</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 mx-auto mb-2 text-chart-4" />
                <p className="text-3xl font-bold" data-testid="text-result-time">{TIMER_DURATION - remainingSeconds}s</p>
                <p className="text-xs text-muted-foreground">Tempo</p>
              </div>
            </div>

            {submitMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando resultado...
              </p>
            )}

            {result.score && (
              <p className="text-sm text-green-600 dark:text-green-400 text-center">
                Resultado salvo no ranking mensal ({LEVEL_LABELS[level]}).
              </p>
            )}

            <div className="flex justify-center gap-3 flex-wrap">
              <Button onClick={handleStart} data-testid="button-retry-test">
                <RotateCcw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => setLocation("/typing/leaderboard")} data-testid="button-view-leaderboard">
                <Trophy className="h-4 w-4 mr-2" />
                Ver Ranking
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

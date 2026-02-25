import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

const BEEP_BASE64 = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUoGAACAgICAgICAgICAgICAgICAgICAgICAgICAf3hxam1uc3R4e36AgICAgICAgICAgICBgoOEhYWGh4eHh4aGhYSDgoGAgICAgICAgH+Af4CAgICAgICAgICAgICAf39+fn19fX19fn5/f4CAgICAgICAgICAgIGBgoKCgoKCgoGBgICAgICAgICAgIB/f35+fX19fX5+f3+AgICAgICAgICAgICBgYKCgoKCgoKBgYCAgICAgICAgICAf39+fn19fX19fn5/f4CAgICAgICAgICAgIGBgoKCgoKCgoGBgICAgICAgICAgIB/f35+fX19fX5+f3+AgICAgICAgICAgICBgYKCgoKCgoKBgYCAgICAgICAgICAgH9/fn59fX19fX5+f3+AgICAgICAgICAgICBgYKCgoKCgoKBgYCAgICAgICAgICAf39+fn19fX19fn5/f4CAgICAgICAgICAgA==";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const lastSeenIdRef = useRef<string | null>(null);
  const hasInteractedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    function handleInteraction() {
      hasInteractedRef.current = true;
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    }
    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
  });

  const { data: recentNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", "polling"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=5", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const playBeep = useCallback(() => {
    if (!hasInteractedRef.current) return;
    try {
      const audio = new Audio(BEEP_BASE64);
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    if (recentNotifications.length === 0) return;

    const maxId = recentNotifications.reduce((max, n) =>
      n.id > max ? n.id : max, recentNotifications[0].id
    );

    if (!initializedRef.current) {
      lastSeenIdRef.current = maxId;
      initializedRef.current = true;
      return;
    }

    if (lastSeenIdRef.current !== null && maxId > lastSeenIdRef.current) {
      const newNotifs = recentNotifications.filter(
        (n) => lastSeenIdRef.current !== null && n.id > lastSeenIdRef.current
      );

      for (const notif of newNotifs) {
        toast({
          title: notif.title,
          description: notif.message,
        });
      }

      if (newNotifs.length > 0) {
        playBeep();
      }

      lastSeenIdRef.current = maxId;
    }
  }, [recentNotifications, toast, playBeep]);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = countData?.count ?? 0;

  function handleNotificationClick(notif: Notification) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.linkUrl) {
      navigate(notif.linkUrl);
      setOpen(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
        data-testid="button-notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 text-xs flex items-center justify-center"
            data-testid="badge-notification-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50" data-testid="dropdown-notifications">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
            ) : (
              <div className="divide-y">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors flex gap-3 items-start ${!notif.isRead ? "bg-primary/5" : ""}`}
                    onClick={() => handleNotificationClick(notif)}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!notif.isRead ? "font-semibold" : ""}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notif.createdAt as unknown as string)}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

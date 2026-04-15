import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { playNotify } from "@/lib/sound";
import type { Notification } from "@shared/schema";

/**
 * NotificationProvider
 *
 * Mounted once inside the authenticated layout. Polls /api/notifications every 15s,
 * detects new entries (id > lastSeenId), fires a toast for each one in order
 * (oldest → newest) and plays the notification sound once.
 *
 * Uses a Set for deduplication so that even if the same batch is returned on
 * two consecutive polls, no toast is repeated.
 */
export function NotificationProvider() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const lastSeenIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const shownIdsRef = useRef(new Set<string>());

  const { data: recent = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", "provider-poll"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=5", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!recent.length) return;

    // newest id in this batch
    const maxId = recent.reduce(
      (max, n) => (n.id > max ? n.id : max),
      recent[0].id
    );

    // First load: just record the baseline, no toasts
    if (!initializedRef.current) {
      lastSeenIdRef.current = maxId;
      initializedRef.current = true;
      recent.forEach((n) => shownIdsRef.current.add(n.id));
      return;
    }

    if (lastSeenIdRef.current === null || maxId <= lastSeenIdRef.current) return;

    const newNotifs = recent
      .filter(
        (n) =>
          n.id > lastSeenIdRef.current! && !shownIdsRef.current.has(n.id)
      )
      // oldest → newest so toasts appear in chronological order
      .sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const notif of newNotifs) {
      shownIdsRef.current.add(notif.id);
      toast({ title: notif.title, description: notif.message });
    }

    if (newNotifs.length > 0) {
      playNotify();
    }

    lastSeenIdRef.current = maxId;
  }, [recent, toast]);

  // Renders nothing – pure side-effect component
  return null;
}
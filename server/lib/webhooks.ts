import { db } from "../db";
import { adminSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export type WebhookEventType =
  | "ticket_created"
  | "ticket_approved"
  | "ticket_rejected"
  | "ticket_status_changed"
  | "ticket_commented"
  | "ticket_resolved";

async function getWebhookConfig(): Promise<{ url: string; enabled: boolean }> {
  const [urlRow] = await db.select().from(adminSettings).where(eq(adminSettings.key, "WEBHOOK_EVENTS_URL"));
  const [enabledRow] = await db.select().from(adminSettings).where(eq(adminSettings.key, "WEBHOOK_EVENTS_ENABLED"));
  return {
    url: urlRow?.value || "",
    enabled: enabledRow?.value === "true",
  };
}

export function emitEvent(type: WebhookEventType, payload: Record<string, any>): void {
  (async () => {
    try {
      const config = await getWebhookConfig();
      if (!config.enabled || !config.url) return;

      const idempotencyKey = `${type}:${payload.ticketId || "unknown"}:${Date.now()}`;
      const body = JSON.stringify({
        type,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const doPost = async (attempt: number) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } catch (err) {
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1000));
            await doPost(attempt + 1);
          }
        }
      };

      await doPost(0);
    } catch {
    }
  })();
}

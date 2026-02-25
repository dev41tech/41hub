import { db } from "../db";
import { ticketSlaPolicies } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Business hours: Mon-Thu 08:00-18:00, Fri 08:00-17:00, Sat/Sun closed
// Timezone: America/Sao_Paulo with fixed UTC-03 offset for MVP
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

interface BusinessDay {
  startHour: number;
  endHour: number;
}

const BUSINESS_DAYS: Record<number, BusinessDay | null> = {
  0: null, // Sunday
  1: { startHour: 8, endHour: 18 }, // Monday
  2: { startHour: 8, endHour: 18 }, // Tuesday
  3: { startHour: 8, endHour: 18 }, // Wednesday
  4: { startHour: 8, endHour: 18 }, // Thursday
  5: { startHour: 8, endHour: 17 }, // Friday
  6: null, // Saturday
};

const FALLBACK_SLA: Record<string, { firstResponseMinutes: number; resolutionMinutes: number }> = {
  URGENTE: { firstResponseMinutes: 60, resolutionMinutes: 480 },
  ALTA: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  MEDIA: { firstResponseMinutes: 480, resolutionMinutes: 4320 },
  BAIXA: { firstResponseMinutes: 1440, resolutionMinutes: 10080 },
};

function utcToBrt(utc: Date): Date {
  return new Date(utc.getTime() + BRT_OFFSET_MS);
}

function brtToUtc(brt: Date): Date {
  return new Date(brt.getTime() - BRT_OFFSET_MS);
}

export function businessMinutesBetween(startUtc: Date, endUtc: Date): number {
  if (endUtc <= startUtc) return 0;
  let total = 0;
  let current = utcToBrt(new Date(startUtc.getTime()));
  const end = utcToBrt(endUtc);

  while (current < end) {
    const dow = current.getDay();
    const bd = BUSINESS_DAYS[dow];

    if (!bd) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const currentHour = current.getHours() + current.getMinutes() / 60;

    if (currentHour < bd.startHour) {
      current.setHours(bd.startHour, 0, 0, 0);
      continue;
    }

    if (currentHour >= bd.endHour) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const endOfDay = new Date(current);
    endOfDay.setHours(bd.endHour, 0, 0, 0);
    const effectiveEnd = end < endOfDay ? end : endOfDay;
    const minutes = (effectiveEnd.getTime() - current.getTime()) / (60 * 1000);
    total += Math.max(0, minutes);

    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return Math.round(total);
}

export function addBusinessMinutes(startUtc: Date, minutes: number): Date {
  let remaining = minutes;
  let current = utcToBrt(startUtc);

  while (remaining > 0) {
    const dow = current.getDay();
    const bd = BUSINESS_DAYS[dow];

    if (!bd) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
      continue;
    }

    const currentHour = current.getHours() + current.getMinutes() / 60;

    if (currentHour < bd.startHour) {
      current.setHours(bd.startHour, 0, 0, 0);
      continue;
    }

    if (currentHour >= bd.endHour) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
      continue;
    }

    const minutesLeftToday = (bd.endHour - currentHour) * 60;
    if (remaining <= minutesLeftToday) {
      current = new Date(current.getTime() + remaining * 60 * 1000);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    }
  }

  return brtToUtc(current);
}

export async function computeSlaDueDates(
  openedAtUtc: Date,
  priority: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"
): Promise<{ firstResponseDueAt: Date; resolutionDueAt: Date }> {
  const [policy] = await db
    .select()
    .from(ticketSlaPolicies)
    .where(and(eq(ticketSlaPolicies.priority, priority), eq(ticketSlaPolicies.isActive, true)));

  const sla = policy || FALLBACK_SLA[priority];

  return {
    firstResponseDueAt: addBusinessMinutes(openedAtUtc, sla.firstResponseMinutes),
    resolutionDueAt: addBusinessMinutes(openedAtUtc, sla.resolutionMinutes),
  };
}

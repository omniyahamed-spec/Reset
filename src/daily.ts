// Daily loop: morning check-in (one thing + first 2-minute move),
// optional 2-minute sprint, evening check-out (did it move?).
// Stored on device first (works offline / without the table), then synced to
// Supabase table `daily_checkins` (see supabase/migrations/20261122_daily_checkins.sql).
import { supabase } from "./supabaseClient";

export type DayOutcome = "yes" | "partly" | "no";

export interface DayLog {
  day: string; // local YYYY-MM-DD
  oneThing: string;
  firstMove: string;
  energy: number | null; // presence score 1–5 at check-in
  checkinAt: string | null;
  sprintDone: boolean;
  outcome: DayOutcome | null;
  blocker: string | null;
  checkoutAt: string | null;
  tomorrow: string; // set at check-out, pre-fills next morning
}

export const BLOCKERS = ["Froze", "Distracted", "No time", "Wrong priority"];
export const FIRST_MOVE_SUGGESTIONS = ["Open it", "Write 1 line", "Send it", "Clear the desk"];
export const CHECKOUT_HOUR = 17; // "Close the day" becomes the main action from 17:00
export const EVENING_DEFAULT = { h: 18, m: 30 };

export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export function emptyDay(day: string): DayLog {
  return {
    day,
    oneThing: "",
    firstMove: "",
    energy: null,
    checkinAt: null,
    sprintDone: false,
    outcome: null,
    blocker: null,
    checkoutAt: null,
    tomorrow: "",
  };
}

const lsKey = (profileId: string) => `reset_days_v1_${profileId}`;

export function loadLocalDays(profileId: string): Record<string, DayLog> {
  try {
    return JSON.parse(localStorage.getItem(lsKey(profileId)) || "{}");
  } catch {
    return {};
  }
}

function saveLocalDays(profileId: string, days: Record<string, DayLog>) {
  try {
    // keep the last 60 days on device
    const keys = Object.keys(days).sort().slice(-60);
    const trimmed: Record<string, DayLog> = {};
    keys.forEach((k) => (trimmed[k] = days[k]));
    localStorage.setItem(lsKey(profileId), JSON.stringify(trimmed));
  } catch {}
}

function toRow(profileId: string, d: DayLog, source: string) {
  return {
    profile_id: profileId,
    day: d.day,
    one_thing: d.oneThing || null,
    first_move: d.firstMove || null,
    energy: d.energy,
    checkin_at: d.checkinAt,
    sprint_done: d.sprintDone,
    outcome: d.outcome,
    blocker: d.blocker,
    checkout_at: d.checkoutAt,
    tomorrow: d.tomorrow || null,
    source,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(r: any): DayLog {
  return {
    day: r.day,
    oneThing: r.one_thing ?? "",
    firstMove: r.first_move ?? "",
    energy: r.energy ?? null,
    checkinAt: r.checkin_at ?? null,
    sprintDone: !!r.sprint_done,
    outcome: r.outcome ?? null,
    blocker: r.blocker ?? null,
    checkoutAt: r.checkout_at ?? null,
    tomorrow: r.tomorrow ?? "",
  };
}

/** Where this visit came from, without consuming it (resets still need it). */
export function peekArrivalSource(): string {
  try {
    const raw = localStorage.getItem("reset_arrival_src");
    if (!raw) return "organic";
    const { src, at } = JSON.parse(raw);
    return Date.now() - at <= 30 * 60 * 1000 ? src : "organic";
  } catch {
    return "organic";
  }
}

/** Save one day: device first, then Supabase (best effort). */
export async function saveDay(
  profileId: string,
  days: Record<string, DayLog>,
  d: DayLog
): Promise<Record<string, DayLog>> {
  const next = { ...days, [d.day]: d };
  saveLocalDays(profileId, next);
  try {
    const { error } = await supabase
      .from("daily_checkins")
      .upsert(toRow(profileId, d, peekArrivalSource()), { onConflict: "profile_id,day" });
    if (error) console.warn("daily_checkins not saved (run the migration?):", error.message);
  } catch (e) {
    console.warn("daily_checkins not saved:", e);
  }
  return next;
}

/** Device copy merged with the server copy (server wins when newer). */
export async function loadDays(profileId: string): Promise<Record<string, DayLog>> {
  const local = loadLocalDays(profileId);
  try {
    const since = shiftDay(dayKey(), -30);
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("profile_id", profileId)
      .gte("day", since);
    if (error || !data) return local;
    const merged = { ...local };
    data.forEach((r: any) => {
      const remote = fromRow(r);
      const mine = merged[remote.day];
      const stamp = (x?: DayLog) => (x ? x.checkoutAt || x.checkinAt || "" : "");
      if (!mine || stamp(remote) >= stamp(mine)) merged[remote.day] = remote;
    });
    saveLocalDays(profileId, merged);
    return merged;
  } catch {
    return local;
  }
}

export interface WeekCell {
  day: string;
  label: string;
  isToday: boolean;
  state: "moved" | "partly" | "no" | "open" | "none";
}

export function weekCells(days: Record<string, DayLog>, today = dayKey()): WeekCell[] {
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(today, i - 6);
    const d = days[day];
    const [y, m, dd] = day.split("-").map(Number);
    const state: WeekCell["state"] = !d
      ? "none"
      : d.outcome === "yes"
      ? "moved"
      : d.outcome === "partly"
      ? "partly"
      : d.outcome === "no"
      ? "no"
      : d.checkinAt
      ? "open"
      : "none";
    return { day, label: labels[new Date(y, m - 1, dd).getDay()], isToday: day === today, state };
  });
}

/** Consecutive closed days ending today (or yesterday if today isn't closed yet). */
export function closedStreak(days: Record<string, DayLog>, today = dayKey()): number {
  let cursor = days[today]?.checkoutAt ? today : shiftDay(today, -1);
  let n = 0;
  while (days[cursor]?.checkoutAt) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

/** One honest sentence from the user's own data. Needs 3+ closed days. */
export function dayInsight(days: Record<string, DayLog>): string {
  const closed = Object.values(days).filter((d) => d.outcome);
  const need = 3 - closed.length;
  if (need > 0) {
    return `Close ${need} more day${need === 1 ? "" : "s"} and Reset shows you your first pattern.`;
  }
  const rate = (xs: DayLog[]) =>
    xs.length ? Math.round((100 * xs.filter((d) => d.outcome === "yes").length) / xs.length) : 0;

  const sprint = closed.filter((d) => d.sprintDone);
  const noSprint = closed.filter((d) => !d.sprintDone);
  if (sprint.length >= 2 && noSprint.length >= 2 && rate(sprint) - rate(noSprint) >= 25) {
    return `On days you start with the 2-minute move, your one thing moves ${rate(sprint)}% of the time. Without it: ${rate(noSprint)}%. Start the 2 minutes.`;
  }

  const high = closed.filter((d) => (d.energy ?? 0) >= 4);
  const low = closed.filter((d) => d.energy !== null && (d.energy ?? 0) <= 2);
  if (high.length >= 2 && low.length >= 2 && Math.abs(rate(high) - rate(low)) >= 25) {
    return rate(high) > rate(low)
      ? `When you arrive present, your one thing moves ${rate(high)}% of days. Scattered: ${rate(low)}%. On scattered days, make the one thing half-size.`
      : `You move more on scattered days (${rate(low)}%) than present ones (${rate(high)}%). Pressure helps you; calm days need a harder deadline.`;
  }

  const blockers: Record<string, number> = {};
  closed.forEach((d) => d.blocker && (blockers[d.blocker] = (blockers[d.blocker] || 0) + 1));
  const top = Object.entries(blockers).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const fix: Record<string, string> = {
      Froze: "That's exactly what Reset is for: tap Reset the moment it starts, not at night.",
      Distracted: "Protect the first 2 minutes. Phone in another room until they're done.",
      "No time": "Your one thing is too big. Tomorrow, pick something you can finish in 30 minutes.",
      "Wrong priority": "Pick tomorrow's one thing tonight, while you can still see the whole day.",
    };
    return `What stops you most: ${top[0].toLowerCase()} (${top[1]}×). ${fix[top[0]] || ""}`.trim();
  }

  return `Your one thing moved ${rate(closed)}% of closed days. Keep closing days; the pattern sharpens every week.`;
}

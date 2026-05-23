import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

type Screen =
  | "onboarding"
  | "profile"
  | "arrival"
  | "presence"
  | "start"
  | "mind"
  | "avoid"
  | "move"
  | "commit"
  | "result"
  | "history"
  | "checkin"
  | "insights"
  | "pulse";

type EntryStatus = "done" | "not_yet";

interface Profile {
  id: string;
  name: string;
}

interface Entry {
  id: string;
  profileId: string;
  mind: string;
  avoiding: string;
  move: string;
  status: EntryStatus;
  feedback: string;
  createdAt: string;
  presenceScore?: number;
}

const MIND_SUGGESTIONS = ["Work", "A person", "Money", "Health"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

const COMMIT_SECONDS = 5;
const DAILY_REMINDER_HOUR = 12;
const MILESTONE_DAYS = [7, 14, 30, 60, 100];

const PRESENCE_LABELS: Record<number, { en: string; ar: string; color: string }> = {
  1: { en: "Completely lost", ar: "مشتت تماماً", color: "#8B1E1E" },
  2: { en: "Scattered", ar: "مشتت", color: "#B85C00" },
  3: { en: "Halfway here", ar: "نصف حاضر", color: "#7A6200" },
  4: { en: "Mostly present", ar: "حاضر غالباً", color: "#2E5E2E" },
  5: { en: "Fully arrived", ar: "حاضر تماماً", color: "#1A3A5C" },
};

const PULSE_AVOIDANCES = [
  { label: "Starting a difficult task", pct: 71 },
  { label: "Sending a message", pct: 54 },
  { label: "Making a decision", pct: 38 },
  { label: "Checking something stressful", pct: 29 },
];

const PULSE_INSIGHTS = [
  { icon: "↑", title: "Monday resets stick", body: "People who reset on Monday are 2× more likely to build a streak than any other day." },
  { icon: "◎", title: "Specific moves get done", body: "Users who name an exact action complete 83% of resets. Vague moves: 41%." },
  { icon: "◑", title: "Peak clarity: 8–10 AM", body: "Most resets happen in the first two hours of the day. Catch yourself early." },
];

const ONBOARDING_SLIDES = [
  {
    tag: "The problem", tagAr: "المشكلة",
    title: "You built everything.\nAnd lost yourself doing it.",
    body: "High performers in the Gulf carry the weight of enormous ambition. And somewhere between the deals, the deadlines, and the expectations — they disappear from themselves.",
    bodyAr: "بنيت كل شيء. وضعت نفسك في كل مكان. لكنك لم تعد تعرف من أنت خارج الإنجاز.",
  },
  {
    tag: "The method", tagAr: "الطريقة",
    title: "3 minutes.\nOne honest move.",
    body: "Not a meditation app. Not a journal. Reset asks you three questions that cut through the noise — what's in your head, what you're avoiding, and what one move gets you unstuck.",
    bodyAr: "ثلاث دقائق. سؤال واحد صادق. خطوة واحدة حقيقية.",
  },
  {
    tag: "Built for you", tagAr: "صُنع لك",
    title: "For high performers\nin the Gulf who know\nthey're more than this.",
    body: "Reset is the first reconnection practice built specifically for the Arab world's overachievers. The ones who have everything — and are quietly running on empty.",
    bodyAr: "لأصحاب الإنجاز في الخليج الذين يعلمون أنهم أكثر من هذا.",
  },
];

function makeProfileId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function getMilestoneLabel(streak: number): string | null {
  if (!MILESTONE_DAYS.includes(streak)) return null;
  if (streak === 7) return "One whole week. You're not who you were.";
  if (streak === 14) return "Two weeks. Momentum is real now.";
  if (streak === 30) return "30 days. Most people quit at 3.";
  if (streak === 60) return "60 days. You are genuinely dangerous.";
  if (streak === 100) return "100. That is not a habit. That is identity.";
  return null;
}

function progressBarStyle(pct: number): CSSProperties {
  return { height: "100%", width: `${pct}%`, background: "#23201D", borderRadius: 999, transition: "width 0.4s ease" };
}

async function getAIFeedback(status: EntryStatus, mind: string, avoiding: string, move: string, name: string, pastPatterns: string, presenceScore: number): Promise<string> {
  const prompt = `You are the voice inside Reset — a reconnection app for high performers in the Gulf region who have lost themselves in their work.
User: ${name}
Presence sc

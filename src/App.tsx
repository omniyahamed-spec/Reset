import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

type Screen =
  | "onboarding"
  | "profile"
  | "arrival"
  | "presence"
  | "start"
  | "mind"
  | "mindreflect"
  | "avoid"
  | "move"
  | "commit"
  | "result"
  | "history"
  | "checkin"
  | "insights"
  | "reflect"
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

// ── DAILY LENS — one principle a day, rotating ─────────────────────────────
// Paraphrased principles associated with each source. Not quotes.
const DAILY_LENSES = [
  {
    source: "Simon Sinek",
    tag: "Start with why",
    body: "The task isn't the point. Ask what today's move is in service of — the move gets easier when it means something.",
  },
  {
    source: "Satya Nadella",
    tag: "Learn-it-all",
    body: "Not yet is data, never a verdict. The learn-it-all beats the know-it-all every single time.",
  },
  {
    source: "Arianna Huffington",
    tag: "Recovery is strategy",
    body: "You can't out-hustle an empty battery. Rest is part of the move, not a reward for finishing it.",
  },
  {
    source: "Jeff Weiner",
    tag: "Compassionate directness",
    body: "Be honest with yourself the way you'd be with someone you respect — completely clear, and kind about it.",
  },
  {
    source: "Richard Branson",
    tag: "Screw it, do it",
    body: "You don't need to feel ready. Start, then learn. Boldness compounds faster than planning ever will.",
  },
  {
    source: "Shopify",
    tag: "One thing, obsessively",
    body: "Depth beats breadth. One small move done daily outperforms ten plans that never leave your head.",
  },
  {
    source: "Uber",
    tag: "Remove the friction",
    body: "Make the next step so easy it's harder not to do it. One tap. One message. Two minutes.",
  },
  {
    source: "Careem",
    tag: "Win one street first",
    body: "A region is won one city block at a time. Win today completely before you plan the month.",
  },
  {
    source: "Aramex",
    tag: "Build where others won't",
    body: "World-class things get built where the map says impossible. Constraints are the brief, not the excuse.",
  },
  {
    source: "Dubai",
    tag: "Ambition as a habit",
    body: "A skyline isn't declared — it's built one unreasonable decision at a time. So is a life.",
  },
  {
    source: "The Diary of a CEO",
    tag: "The unglamorous rep",
    body: "Every builder's story is the same underneath: the boring rep, repeated. Today's reset is your rep.",
  },
];

function getDailyLens() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_LENSES[dayOfYear % DAILY_LENSES.length];
}

const PRESENCE_LABELS: Record<number, { en: string; sub: string; color: string }> = {
  1: { en: "Completely lost", sub: "Can't land anywhere", color: "#E53E3E" },
  2: { en: "Scattered", sub: "Head in 5 places", color: "#ED6C02" },
  3: { en: "Halfway here", sub: "Part of me is missing", color: "#D4A017" },
  4: { en: "Mostly present", sub: "Almost there", color: "#2E7D52" },
  5: { en: "Fully here", sub: "Grounded and clear", color: "#0D7C6E" },
};

const PULSE_AVOIDANCES = [
  { label: "Starting a difficult task", pct: 71 },
  { label: "Sending a message", pct: 54 },
  { label: "Making a decision", pct: 38 },
  { label: "Checking something stressful", pct: 29 },
];

const PULSE_INSIGHTS = [
  {
    icon: "↑",
    title: "Monday resets stick",
    body: "People who reset on Monday are 2× more likely to build a streak than any other day.",
  },
  {
    icon: "◎",
    title: "Specific moves get done",
    body: "Users who name an exact action complete 83% of resets. Vague moves: 41%.",
  },
  {
    icon: "◑",
    title: "Peak clarity: 8–10 AM",
    body: "Most resets happen in the first two hours of the day. Catch yourself early.",
  },
];

// ── AVATAR KEYFRAMES — shared across all dark screens ─────────────────────
const AVATAR_KEYFRAMES = `
  @keyframes avatarMorph {
    0%   { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
    20%  { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    40%  { border-radius: 50% 40% 60% 30% / 40% 70% 30% 60%; }
    60%  { border-radius: 40% 60% 50% 40% / 70% 30% 60% 50%; }
    80%  { border-radius: 55% 45% 35% 65% / 45% 55% 45% 55%; }
    100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  }
  @keyframes avatarBreathIn {
    0%   { transform: scale(0.88); opacity: 0.7; }
    100% { transform: scale(1.12); opacity: 1; }
  }
  @keyframes avatarBreathOut {
    0%   { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(0.88); opacity: 0.7; }
  }
  @keyframes avatarDrift {
    0%   { transform: scale(1) translate(0px, 0px); opacity: 0.82; }
    25%  { transform: scale(1.04) translate(2px, -4px); opacity: 1; }
    50%  { transform: scale(0.96) translate(-2px, 3px); opacity: 0.78; }
    75%  { transform: scale(1.03) translate(3px, 1px); opacity: 0.94; }
    100% { transform: scale(1) translate(0px, 0px); opacity: 0.82; }
  }
  @keyframes avatarRingExpand {
    0%, 100% { transform: scale(1); opacity: 0.18; }
    50%       { transform: scale(1.14); opacity: 0.07; }
  }
  @keyframes avatarInnerGlow {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50%       { opacity: 0.9;  transform: scale(1.35); }
  }
  @keyframes avatarGrainShift {
    0%   { transform: translate(0,0); }
    20%  { transform: translate(-1px,1px); }
    40%  { transform: translate(1px,-1px); }
    60%  { transform: translate(-1px,0px); }
    80%  { transform: translate(1px,1px); }
    100% { transform: translate(0,0); }
  }
`;

// ── CALM AVATAR COMPONENT ──────────────────────────────────────────────────
function CalmAvatar({
  phase = "still",
  size = 140,
  accentHex = "#B47832",
}: {
  phase?: "in" | "out" | "still" | "reflect";
  size?: number;
  accentHex?: string;
}) {
  // Convert hex to rgba helper
  function rgba(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  const driftDuration = phase === "reflect" ? "9s" : "14s";
  const blobAnim =
    phase === "in"
      ? "avatarBreathIn 4s ease-in-out forwards"
      : phase === "out"
      ? "avatarBreathOut 4s ease-in-out forwards"
      : `avatarDrift ${driftDuration} ease-in-out infinite`;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* Far outer atmospheric wash */}
      <div
        style={{
          position: "absolute",
          width: size * 2.2,
          height: size * 2.2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(accentHex, 0.07)} 0%, transparent 60%)`,
          animation: `avatarRingExpand ${driftDuration} ease-in-out infinite`,
          animationDelay: "-3s",
          pointerEvents: "none",
        }}
      />
      {/* Mid ring */}
      <div
        style={{
          position: "absolute",
          width: size * 1.35,
          height: size * 1.35,
          borderRadius: "50%",
          border: `1px solid ${rgba(accentHex, 0.14)}`,
          animation: `avatarRingExpand 7s ease-in-out infinite`,
          animationDelay: "-1s",
          pointerEvents: "none",
        }}
      />
      {/* Inner ring */}
      <div
        style={{
          position: "absolute",
          width: size * 1.08,
          height: size * 1.08,
          borderRadius: "50%",
          border: `1px solid ${rgba(accentHex, 0.09)}`,
          animation: `avatarRingExpand 5s ease-in-out infinite`,
          animationDelay: "-4s",
          pointerEvents: "none",
        }}
      />

      {/* Main morphing blob — breathes */}
      <div
        style={{
          width: size * 0.73,
          height: size * 0.73,
          animation: blobAnim,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `radial-gradient(ellipse at 38% 33%, ${rgba(accentHex, 0.65)} 0%, ${rgba(
              accentHex,
              0.28
            )} 40%, transparent 72%)`,
            animation: "avatarMorph 16s ease-in-out infinite",
            boxShadow: `0 0 ${size * 0.4}px ${rgba(accentHex, 0.22)}, 0 0 ${
              size * 0.15
            }px ${rgba(accentHex, 0.12)} inset`,
            filter: "blur(0.5px)",
          }}
        />
        {/* Inner light spark */}
        <div
          style={{
            position: "absolute",
            width: size * 0.19,
            height: size * 0.19,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${rgba(accentHex, 1)} 0%, transparent 70%)`,
            animation: "avatarInnerGlow 3.5s ease-in-out infinite",
            top: "26%",
            left: "28%",
            filter: "blur(2px)",
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

function makeProfileId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getMilestoneLabel(streak: number): string | null {
  if (!MILESTONE_DAYS.includes(streak)) return null;
  if (streak === 7) return "One whole week. You're not who you were.";
  if (streak === 14) return "Two weeks. Momentum is real now.";
  if (streak === 30) return "30 days. Most people quit at 3.";
  if (streak === 60)
    return "60 days. Skylines have been built on less consistency.";
  if (streak === 100) return "100. That is not a habit. That is identity.";
  return null;
}

function progressBarStyle(pct: number): CSSProperties {
  return {
    height: "100%",
    width: `${pct}%`,
    background: "#23201D",
    borderRadius: 999,
    transition: "width 0.4s ease",
  };
}

async function getMindReflection(mind: string, name: string): Promise<string> {
  const prompt = `You are the inner voice of Reset — a clarity app for anyone whose head is too full to think straight.

The user just typed what's on their mind: "${mind}"

Write exactly ONE sentence that cuts beneath the surface of what they wrote.
Be specific to their exact words. Not generic. Not motivational.
The sentence should make them think "how did it know that."
Tone: direct, warm, a little sharp. Like someone who's been there.
Do NOT start with "I". No emojis. No explanation. Just the one sentence.`;

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    return text.trim() || getFallbackReflection(mind);
  } catch {
    return getFallbackReflection(mind);
  }
}

function getTimeBasedHero(): { title: string; sub: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 9)
    return {
      title: "The day hasn't taken you yet.\nGet ahead of it.",
      sub: "You have clarity right now that won't last. Use it.",
    };
  if (h >= 9 && h < 12)
    return {
      title: "Mid-morning. The noise\nis building.",
      sub: "Before it takes over — name the one thing and move.",
    };
  if (h >= 12 && h < 15)
    return {
      title: "You've been in it\nfor hours.",
      sub: "Step out for 3 minutes. Come back knowing what actually matters.",
    };
  if (h >= 15 && h < 18)
    return {
      title: "The afternoon dip\nis real.",
      sub: "Not energy — clarity. One honest reset before the day closes.",
    };
  if (h >= 18 && h < 22)
    return {
      title: "Day's done.\nAre you?",
      sub: "Name what you're still carrying before you take it to bed.",
    };
  return {
    title: "You're awake\nwhen most aren't.",
    sub: "Something's on your mind. Let's look at it. Then protect your sleep — recovery is part of the move.",
  };
}

async function getPatternFlash(entries: Entry[], name: string): Promise<string> {
  if (entries.length < 3) return "";
  const recent = entries.slice(0, 6);
  const summary = recent
    .map(
      (e, i) =>
        `Reset ${i + 1}: mind="${e.mind}", avoiding="${e.avoiding}", move="${e.move}", status=${e.status}`
    )
    .join("\n");

  const prompt = `You are the pattern-recognition voice of Reset — a clarity app for busy, overloaded people everywhere.

Here are ${name}'s last ${recent.length} resets:
${summary}

Surface ONE unexpected pattern, connection, or truth you see across these entries.
Not what they told you — what the pattern reveals that they probably haven't said out loud.
1-2 sentences max. Sharp. Specific. Make them feel seen in a way that's slightly uncomfortable.
No lists. No generic advice. No emojis. Don't start with "I".`;

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    return data.content?.find((b: any) => b.type === "text")?.text?.trim() ?? "";
  } catch {
    return "";
  }
}

function getFallbackReflection(mind: string): string {
  const m = mind.toLowerCase();
  if (m.includes("work") || m.includes("job") || m.includes("meeting"))
    return "It's not really about the work — it's about what the work means about you.";
  if (m.includes("money") || m.includes("finance") || m.includes("debt"))
    return "The number isn't the fear — the story about what it says about you is.";
  if (m.includes("person") || m.includes("people") || m.includes("someone"))
    return "You're carrying someone else's weight as if it were yours to fix.";
  if (m.includes("health") || m.includes("body") || m.includes("tired"))
    return "Your body is telling you something your mind keeps dismissing.";
  return "That thing you keep thinking about — it's not the real problem, it's the signal.";
}

async function getAIFeedback(
  status: EntryStatus,
  mind: string,
  avoiding: string,
  move: string,
  name: string,
  pastPatterns: string,
  presenceScore: number,
  userWhy: string
): Promise<string> {
  const prompt = `You are the voice inside Reset — a clarity app for anyone whose head is too full and who needs to move.

User: ${name}
Presence score today: ${presenceScore}/5 (${PRESENCE_LABELS[presenceScore]?.en})
Status: ${status === "done" ? "They DID the move" : "They did NOT do the move yet"}
What was on their mind: "${mind}"
What they were avoiding: "${avoiding}"
Their committed move: "${move}"
${userWhy ? `Their deeper why — what all of this is in service of: "${userWhy}". Connect the move to it only if it fits naturally.` : ""}
${pastPatterns ? `Their recent patterns: ${pastPatterns}` : ""}

Write 2-3 sentences. Be specific to EXACTLY what they wrote.
Reference their presence score naturally — someone at 1-2 needs gentleness and permission to rest, someone at 4-5 needs a push toward the bolder version.
Growth mindset: treat "not yet" as data and learning, never as failure or a character flaw.
Compassionate directness: completely honest, zero sugarcoating, but on their side.
Tone: like a wise, warm friend who has been in the thick of it and knows what it costs to stay stuck. Never corporate. Never generic.
Never start with "I" or the user's name. No emojis. No lists.`;

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    return text.trim() || getFallbackFeedback(status);
  } catch {
    return getFallbackFeedback(status);
  }
}

function getFallbackFeedback(status: EntryStatus): string {
  if (status === "done")
    return "You moved. That's the whole game — not perfection, just momentum. Do it again tomorrow.";
  return "Not yet is just data. The move was probably too big. Cut it in half and try the smaller door.";
}

function analyzePatterns(entries: Entry[]): {
  topAvoiding: string | null;
  completionRate: number;
  mostProductiveDays: string[];
  avgPresence: number;
} {
  if (entries.length < 3)
    return { topAvoiding: null, completionRate: 0, mostProductiveDays: [], avgPresence: 0 };

  const avoidingMap: Record<string, number> = {};
  entries.forEach((e) => {
    const key = e.avoiding.toLowerCase().trim();
    avoidingMap[key] = (avoidingMap[key] || 0) + 1;
  });
  const topAvoiding =
    Object.entries(avoidingMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const done = entries.filter((e) => e.status === "done").length;
  const completionRate = Math.round((done / entries.length) * 100);

  const dayMap: Record<string, { done: number; total: number }> = {};
  entries.forEach((e) => {
    const day = new Date(e.createdAt).toLocaleDateString(undefined, {
      weekday: "long",
    });
    if (!dayMap[day]) dayMap[day] = { done: 0, total: 0 };
    dayMap[day].total++;
    if (e.status === "done") dayMap[day].done++;
  });
  const mostProductiveDays = Object.entries(dayMap)
    .filter(([, v]) => v.total >= 2)
    .sort((a, b) => b[1].done / b[1].total - a[1].done / a[1].total)
    .slice(0, 2)
    .map(([day]) => day);

  const presenceEntries = entries.filter((e) => e.presenceScore);
  const avgPresence = presenceEntries.length
    ? Math.round(
        (presenceEntries.reduce((sum, e) => sum + (e.presenceScore || 0), 0) /
          presenceEntries.length) *
          10
      ) / 10
    : 0;

  return { topAvoiding, completionRate, mostProductiveDays, avgPresence };
}

function buildPastPatternsSummary(entries: Entry[]): string {
  if (entries.length < 3) return "";
  const recent = entries.slice(0, 7);
  const avoidingList = Array.from(new Set(recent.map((e) => e.avoiding)))
    .slice(0, 3)
    .join(", ");
  const doneCount = recent.filter((e) => e.status === "done").length;
  const avgPresence =
    recent.filter((e) => e.presenceScore).reduce((s, e) => s + (e.presenceScore || 0), 0) /
    (recent.filter((e) => e.presenceScore).length || 1);
  return `Recently avoided: ${avoidingList}. Completed ${doneCount}/${recent.length} recent moves. Average presence: ${avgPresence.toFixed(1)}/5.`;
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
function scheduleLocalReminder(profileName: string) {
  localStorage.setItem("reset_reminder_enabled", "true");
  localStorage.setItem("reset_reminder_name", profileName);
}
function cancelLocalReminder() {
  localStorage.removeItem("reset_reminder_enabled");
}
function checkAndFireReminder(profileName: string, hasResetToday: boolean) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const enabled = localStorage.getItem("reset_reminder_enabled");
  if (!enabled) return;
  const now = new Date();
  const hour = now.getHours();
  const lastFired = localStorage.getItem("reset_reminder_last_fired");
  const today = startOfDay(now).toISOString();
  if (lastFired === today) return;
  if (hour < DAILY_REMINDER_HOUR) return;
  if (hasResetToday) return;
  localStorage.setItem("reset_reminder_last_fired", today);
  new Notification("Reset — time to arrive", {
    body: `Hey ${profileName}. Before the noise takes over. One minute to come back to yourself.`,
    icon: "/favicon.ico",
    tag: "reset-daily",
  });
}

// ── 90-DAY JOURNEY ─────────────────────────────────────────────────────────
interface Journey {
  start: string;
  vision: string;
  seal: string;
  opened: { [k: string]: boolean };
  cycle: number;
}

const SEAL_DAYS = [30, 60, 90];

function loadJourney(): Journey | null {
  try {
    const raw = localStorage.getItem("reset_journey");
    return raw ? (JSON.parse(raw) as Journey) : null;
  } catch {
    return null;
  }
}

function saveJourneyLS(j: Journey) {
  localStorage.setItem("reset_journey", JSON.stringify(j));
}

function journeyDayOf(j: Journey): number {
  const days =
    Math.floor(
      (startOfDay(new Date()).getTime() -
        startOfDay(new Date(j.start)).getTime()) /
        86400000
    ) + 1;
  return Math.max(1, Math.min(90, days));
}

function sealTarget(day: number): number {
  return Math.round(day * 0.7);
}

async function getWeeklyReflection(
  answers: string[],
  name: string,
  vision: string,
  week: number
): Promise<string> {
  const prompt = `You are the weekly reflection voice of Reset — the diary that coaches back.

User: ${name}. Week ${week} of a 90-day journey toward this vision: "${vision}"
Their answers this week:
1. Move that mattered most: "${answers[0]}"
2. What they avoided all week: "${answers[1]}"
3. What to drop next week: "${answers[2]}"

Write 2-3 sentences responding to their week. Be specific to their exact words.
Connect back to their vision only if it fits naturally.
Growth mindset, compassionate directness. Honest, warm, zero fluff.
Don't start with "I" or their name. No emojis. No lists.`;

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    return (
      text.trim() ||
      "A week of showing up is a week of evidence. Look at what you avoided — that's next week's first move."
    );
  } catch {
    return "A week of showing up is a week of evidence. Look at what you avoided — that's next week's first move.";
  }
}

function mapEntry(row: any): Entry {
  return {
    id: row.id,
    profileId: row.profile_id,
    mind: row.mind,
    avoiding: row.avoiding,
    move: row.move,
    status: row.status,
    feedback: row.feedback,
    createdAt: row.created_at,
    presenceScore: row.presence_score,
  };
}

const ONBOARDING_SLIDES = [
  {
    tag: "Sound familiar?",
    accent: "#E05D2A",
    title: "Your head is full.\nYou can't start.",
    body: "You know what you need to do. But something keeps you spinning — rehashing, overthinking, avoiding. It happens to everyone. Every day.",
  },
  {
    tag: "The fix",
    accent: "#0D9488",
    title: "3 minutes.\nOne honest move.",
    body: "Not therapy. Not a todo list. Just three questions that cut through the noise — name what's in your head, what you're avoiding, and the one small action that actually moves things.",
  },
  {
    tag: "Just do it",
    accent: "#7C3AED",
    title: "Stop thinking.\nStart moving.",
    body: "Reset turns the loop in your head into a single action. That's it. Do it daily and watch what shifts.",
  },
];

function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const [slide, setSlide] = useState(0);
  const current = ONBOARDING_SLIDES[slide];
  const isLast = slide === ONBOARDING_SLIDES.length - 1;

  function next() {
    if (isLast) {
      localStorage.setItem("reset_onboarded", "true");
      onFinish();
    } else {
      setSlide((s) => s + 1);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0807",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 28px",
      position: "relative", overflow: "hidden",
      transition: "background 0.6s ease",
    }}>
      <style>{`
        ${AVATAR_KEYFRAMES}
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes obGlow {
          0%,100% { opacity: 0.08; transform: scale(1); }
          50%      { opacity: 0.18; transform: scale(1.22); }
        }
        @keyframes obSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Per-slide vivid color wash */}
      <div style={{
        position: "fixed", inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${current.accent}22 0%, transparent 65%)`,
        transition: "background 0.7s ease",
        pointerEvents: "none",
      }} />
      {/* Ambient orb */}
      <div style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div style={{
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${current.accent}33 0%, transparent 65%)`,
          animation: "obGlow 7s ease-in-out infinite",
          transition: "background 0.7s ease",
        }} />
      </div>

      <div style={{
        position: "fixed", top: 24, left: 0, right: 0,
        textAlign: "center", fontSize: 11, fontWeight: 800,
        letterSpacing: "0.22em", textTransform: "uppercase",
        color: "rgba(245,241,234,0.22)",
      }}>Reset</div>

      {slide > 0 && (
        <button onClick={() => { localStorage.setItem("reset_onboarded", "true"); onFinish(); }}
          style={{
            position: "fixed", top: 20, right: 24,
            fontSize: 12, color: "rgba(245,241,234,0.28)",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.05em",
          }}>Skip</button>
      )}

      <div key={slide} style={{
        width: "100%", maxWidth: 420,
        animation: "obSlideIn 0.5s ease forwards",
        textAlign: "center",
      }}>
        {/* Vivid tag pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          marginBottom: 36,
          background: `${current.accent}22`,
          border: `1px solid ${current.accent}55`,
          borderRadius: 999,
          padding: "6px 16px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: current.accent,
            boxShadow: `0 0 8px ${current.accent}`,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
            textTransform: "uppercase", color: current.accent,
          }}>{current.tag}</span>
        </div>

        <div style={{
          fontSize: 36, fontWeight: 700,
          color: "rgba(245,241,234,0.95)",
          fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
          letterSpacing: "-0.04em", lineHeight: 1.1,
          marginBottom: 22, whiteSpace: "pre-line",
        }}>{current.title}</div>

        <div style={{
          fontSize: 15, color: "rgba(245,241,234,0.5)",
          lineHeight: 1.7, marginBottom: 52,
          maxWidth: 360, margin: "0 auto 52px",
        }}>{current.body}</div>

        <button onClick={next} style={{
          padding: "16px 44px", borderRadius: 999,
          border: isLast ? "none" : `1px solid ${current.accent}44`,
          background: isLast ? current.accent : `${current.accent}18`,
          color: "rgba(245,241,234,0.92)",
          fontSize: 15, fontWeight: isLast ? 800 : 500,
          cursor: "pointer", fontFamily: "inherit",
          letterSpacing: isLast ? "0.01em" : "0.05em",
          transition: "all 0.3s ease",
          boxShadow: isLast ? `0 8px 32px ${current.accent}44` : "none",
        }}>{isLast ? "Let's go →" : "Continue →"}</button>
      </div>

      {/* Slide dots */}
      <div style={{
        position: "fixed", bottom: 40,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        {ONBOARDING_SLIDES.map((s, i) => (
          <div key={i} style={{
            width: i === slide ? 22 : 6, height: 6,
            borderRadius: 999,
            background: i === slide ? s.accent : "rgba(245,241,234,0.12)",
            transition: "all 0.35s ease",
            boxShadow: i === slide ? `0 0 8px ${s.accent}` : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

function PulseTeaser({ onExpand }: { onExpand: () => void }) {
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        background: "#161413",
        borderRadius: 24,
        padding: "20px 22px",
        marginBottom: 14,
        border: "1px solid #2A2520",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,120,50,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(245,241,234,0.35)",
              marginBottom: 4,
            }}
          >
            Community pulse
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(245,241,234,0.88)",
              fontFamily:
                'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            What others are doing right now
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4CAF50",
              boxShadow: "0 0 6px rgba(76,175,80,0.6)",
              animation: "pulseLive 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "rgba(245,241,234,0.4)",
              letterSpacing: "0.04em",
            }}
          >
            1,240 today
          </span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {[
          { num: "11", label: "avg streak" },
          { num: "78%", label: "completed" },
          { num: "9 AM", label: "peak hour" },
        ].map(({ num, label }) => (
          <div
            key={label}
            style={{
              background: "rgba(245,241,234,0.04)",
              border: "1px solid rgba(245,241,234,0.07)",
              borderRadius: 14,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "rgba(245,241,234,0.85)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                fontFamily:
                  'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              }}
            >
              {num}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(245,241,234,0.3)",
                marginTop: 4,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(245,241,234,0.3)",
            marginBottom: 12,
          }}
        >
          Most avoided this week
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span
                  style={{ fontSize: 12, color: "rgba(245,241,234,0.55)" }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(245,241,234,0.3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.pct}%
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: "rgba(245,241,234,0.07)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background:
                      i === 0
                        ? "rgba(180,120,50,0.7)"
                        : i === 1
                        ? "rgba(245,241,234,0.25)"
                        : "rgba(245,241,234,0.13)",
                    width: barsVisible ? `${item.pct}%` : "0%",
                    transition: `width 0.9s ease ${i * 0.12}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(245,241,234,0.06)",
          marginBottom: 16,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(180,120,50,0.12)",
            border: "1px solid rgba(180,120,50,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 13,
            color: "rgba(200,150,70,0.8)",
          }}
        >
          ↑
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(245,241,234,0.75)",
              marginBottom: 3,
            }}
          >
            Monday resets build streaks
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(245,241,234,0.35)",
              lineHeight: 1.55,
            }}
          >
            People who reset on Monday are 2× more likely to still be going by
            Friday.
          </div>
        </div>
      </div>
      <button
        onClick={onExpand}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 14,
          border: "1px solid rgba(245,241,234,0.1)",
          background: "rgba(245,241,234,0.04)",
          color: "rgba(245,241,234,0.5)",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(245,241,234,0.08)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(245,241,234,0.75)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(245,241,234,0.04)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(245,241,234,0.5)";
        }}
      >
        See full community map
        <span style={{ fontSize: 11, opacity: 0.6 }}>→</span>
      </button>
    </div>
  );
}

function PulseScreen({ onBack }: { onBack: () => void }) {
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        background: "#161413",
        borderRadius: 28,
        padding: "24px 22px",
        border: "1px solid #2A2520",
        marginBottom: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,120,50,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(245,241,234,0.3)",
              marginBottom: 6,
            }}
          >
            Community pulse
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "rgba(245,241,234,0.9)",
              fontFamily:
                'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            How the world resets.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(245,241,234,0.3)",
              fontStyle: "italic",
              marginTop: 4,
            }}
          >
            كيف يعيد الناس ضبط أنفسهم
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4CAF50",
              boxShadow: "0 0 6px rgba(76,175,80,0.6)",
              animation: "pulseLive 2s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(245,241,234,0.35)" }}>
            Live
          </span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {[
          { num: "1,240", label: "Resets today", sub: "across all users" },
          { num: "78%", label: "Completed today", sub: "marked as done" },
          {
            num: "11 days",
            label: "Average streak",
            sub: "among active users",
          },
          {
            num: "9 AM",
            label: "Peak reset time",
            sub: "most users arrive early",
          },
        ].map(({ num, label, sub }) => (
          <div
            key={label}
            style={{
              background: "rgba(245,241,234,0.03)",
              border: "1px solid rgba(245,241,234,0.07)",
              borderRadius: 16,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: "rgba(245,241,234,0.88)",
                fontFamily:
                  'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {num}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(245,241,234,0.6)",
                marginTop: 5,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(245,241,234,0.25)",
                marginTop: 2,
              }}
            >
              {sub}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(245,241,234,0.3)",
            marginBottom: 14,
          }}
        >
          Most avoided this week
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{ fontSize: 13, color: "rgba(245,241,234,0.6)" }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color:
                      i === 0
                        ? "rgba(200,150,70,0.8)"
                        : "rgba(245,241,234,0.3)",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >
                  {item.pct}%
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: "rgba(245,241,234,0.06)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background:
                      i === 0
                        ? "linear-gradient(90deg,rgba(180,120,50,0.8),rgba(220,160,60,0.6))"
                        : i === 1
                        ? "rgba(245,241,234,0.22)"
                        : i === 2
                        ? "rgba(245,241,234,0.14)"
                        : "rgba(245,241,234,0.08)",
                    width: barsVisible ? `${item.pct}%` : "0%",
                    transition: `width 1s ease ${i * 0.15}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(245,241,234,0.06)",
          marginBottom: 20,
        }}
      />
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(245,241,234,0.3)",
            marginBottom: 14,
          }}
        >
          Behavioural patterns
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PULSE_INSIGHTS.map((ins) => (
            <div
              key={ins.title}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: "rgba(180,120,50,0.1)",
                  border: "1px solid rgba(180,120,50,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 14,
                  color: "rgba(200,150,70,0.75)",
                }}
              >
                {ins.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(245,241,234,0.78)",
                    marginBottom: 3,
                  }}
                >
                  {ins.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(245,241,234,0.38)",
                    lineHeight: 1.6,
                  }}
                >
                  {ins.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(245,241,234,0.3)",
            marginBottom: 12,
          }}
        >
          How people arrive
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Fully arrived", pct: 18, score: 5 },
            { label: "Mostly present", pct: 34, score: 4 },
            { label: "Halfway here", pct: 28, score: 3 },
            { label: "Scattered", pct: 14, score: 2 },
            { label: "Completely lost", pct: 6, score: 1 },
          ].map((item) => {
            const colors: Record<number, string> = {
              5: "rgba(26,82,118,0.8)",
              4: "rgba(46,125,82,0.7)",
              3: "rgba(184,148,10,0.7)",
              2: "rgba(212,99,10,0.65)",
              1: "rgba(192,57,43,0.65)",
            };
            return (
              <div
                key={item.label}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 90,
                    fontSize: 11,
                    color: "rgba(245,241,234,0.4)",
                    textAlign: "right",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "rgba(245,241,234,0.06)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      background: colors[item.score],
                      width: barsVisible ? `${item.pct}%` : "0%",
                      transition: `width 1s ease ${item.score * 0.1}s`,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 28,
                    fontSize: 11,
                    color: "rgba(245,241,234,0.3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(245,241,234,0.06)",
          marginBottom: 16,
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: "rgba(245,241,234,0.2)",
          lineHeight: 1.6,
          marginBottom: 18,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        Data is anonymous and aggregated. No individual entries are visible to
        others.
      </div>
      <button
        onClick={onBack}
        style={{
          width: "100%",
          padding: "13px 16px",
          borderRadius: 14,
          border: "1px solid rgba(245,241,234,0.12)",
          background: "transparent",
          color: "rgba(245,241,234,0.45)",
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ← Back
      </button>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("profile");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileError, setProfileError] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [presenceScore, setPresenceScore] = useState<number>(0);
  const [countdown, setCountdown] = useState(COMMIT_SECONDS);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [breathePhase, setBreathePhase] = useState<"in" | "out">("in");
  const [breatheCount, setBreatheCount] = useState(0);
  const [arrivalUnlocked, setArrivalUnlocked] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [checkinEntry, setCheckinEntry] = useState<Entry | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const [followUpSeconds, setFollowUpSeconds] = useState<number | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpAnswer, setFollowUpAnswer] = useState<
    "confirmed" | "slipped" | null
  >(null);
  const [mindReflection, setMindReflection] = useState<string>("");
  const [mindReflectionLoading, setMindReflectionLoading] = useState(false);
  const [patternFlash, setPatternFlash] = useState<string>("");
  const [showPatternFlash, setShowPatternFlash] = useState(false);

  // ── WHY (Sinek layer) — one line, stored on device ──
  const [why, setWhy] = useState<string>(
    () => localStorage.getItem("reset_why") ?? ""
  );
  const [whyDraft, setWhyDraft] = useState("");

  function saveWhy() {
    const w = whyDraft.trim();
    if (!w) return;
    localStorage.setItem("reset_why", w);
    setWhy(w);
    setWhyDraft("");
  }

  // ── JOURNEY STATE ──
  const [journey, setJourney] = useState<Journey | null>(() => loadJourney());
  const [visionDraft, setVisionDraft] = useState("");
  const [sealDraft, setSealDraft] = useState("");
  const [openSeal, setOpenSeal] = useState<number | null>(null);
  const [reflectAnswers, setReflectAnswers] = useState<string[]>(["", "", ""]);
  const [reflectAI, setReflectAI] = useState("");
  const [reflectLoading, setReflectLoading] = useState(false);
  const [lastReflectedWeek, setLastReflectedWeek] = useState<number>(() =>
    parseInt(localStorage.getItem("reset_last_reflect_week") || "0", 10)
  );

  const mindRef = useRef<HTMLInputElement>(null);
  const avoidRef = useRef<HTMLInputElement>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screen !== "arrival") return;
    const timer = window.setInterval(() => {
      setBreathePhase((p) => (p === "in" ? "out" : "in"));
      setBreatheCount((c) => {
        const next = c + 1;
        if (next >= 3) setArrivalUnlocked(true);
        return next;
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    async function init() {
      const savedProfileId = localStorage.getItem("reset_profile_id");
      const reminderEnabled =
        localStorage.getItem("reset_reminder_enabled") === "true";
      setNotifEnabled(reminderEnabled);
      if ("Notification" in window) setNotifPermission(Notification.permission);
      const hasOnboarded = localStorage.getItem("reset_onboarded") === "true";
      if (!savedProfileId) {
        setScreen(hasOnboarded ? "profile" : "onboarding");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", savedProfileId)
        .single();
      if (error || !data) {
        setScreen("profile");
        setLoading(false);
        return;
      }
      setProfile(data as Profile);
      setProfileName(data.name ?? "");
      await loadEntries(savedProfileId);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (loading || !profile) return;
    const hasResetToday = entries.some(
      (e) =>
        startOfDay(new Date(e.createdAt)).getTime() ===
        startOfDay(new Date()).getTime()
    );
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const hadYesterday = entries.some(
      (e) =>
        e.status === "done" &&
        startOfDay(new Date(e.createdAt)).getTime() ===
          startOfDay(yesterday).getTime()
    );
    if (hadYesterday && !hasResetToday) setStreakAtRisk(true);
    const yesterdayNotYet = entries.find(
      (e) =>
        e.status === "not_yet" &&
        startOfDay(new Date(e.createdAt)).getTime() ===
          startOfDay(yesterday).getTime()
    );
    if (yesterdayNotYet && !hasResetToday) {
      setCheckinEntry(yesterdayNotYet);
      setScreen("checkin");
    } else if (!hasResetToday) {
      setScreen("arrival");
    } else {
      setScreen("start");
    }
    checkAndFireReminder(profile.name, hasResetToday);
  }, [loading, profile, entries.length]); // eslint-disable-line

  async function loadEntries(profileId: string) {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data.map(mapEntry));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (screen === "mind") mindRef.current?.focus();
      if (screen === "avoid") avoidRef.current?.focus();
      if (screen === "move") moveRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "commit" || countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        setBreathePhase((p) =>
          next % 2 === 0 ? (p === "in" ? "out" : "in") : p
        );
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown]);

  useEffect(() => {
    if (followUpSeconds === null || followUpSeconds <= 0) {
      if (followUpSeconds === 0) setShowFollowUp(true);
      return;
    }
    const timer = window.setTimeout(
      () => setFollowUpSeconds((s) => (s ?? 1) - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [followUpSeconds]);

  const latestEntry = useMemo(
    () =>
      latestId ? entries.find((e) => e.id === latestId) ?? null : null,
    [entries, latestId]
  );

  const doneCount = useMemo(
    () => entries.filter((e) => e.status === "done").length,
    [entries]
  );
  const notYetCount = useMemo(
    () => entries.filter((e) => e.status === "not_yet").length,
    [entries]
  );
  const totalResets = entries.length;
  const lastNotYet = useMemo(
    () => entries.find((e) => e.status === "not_yet"),
    [entries]
  );

  // ── RECOVERY SIGNAL (Huffington layer) — avg presence of last 3 scored entries ──
  const recentPresenceAvg = useMemo(() => {
    const recent = entries.filter((e) => e.presenceScore).slice(0, 3);
    if (recent.length < 2) return 0;
    return (
      recent.reduce((s, e) => s + (e.presenceScore || 0), 0) / recent.length
    );
  }, [entries]);
  const needsRecovery = recentPresenceAvg > 0 && recentPresenceAvg <= 2.4;

  // ── DAILY LENS — rotates once per day ──
  const lens = useMemo(() => getDailyLens(), []);

  // ── JOURNEY DERIVED ──
  const journeyDay = journey ? journeyDayOf(journey) : 0;
  const journeyWeek = journey ? Math.min(13, Math.ceil(journeyDay / 7)) : 0;
  const doneInJourney = useMemo(
    () =>
      journey
        ? entries.filter(
            (e) =>
              e.status === "done" &&
              new Date(e.createdAt) >= startOfDay(new Date(journey.start))
          ).length
        : 0,
    [entries, journey]
  );
  const nextSeal = journey
    ? SEAL_DAYS.find((d) => !journey.opened[String(d)]) ?? null
    : null;
  const sealReady =
    journey !== null &&
    nextSeal !== null &&
    journeyDay >= nextSeal &&
    doneInJourney >= sealTarget(nextSeal);
  const reflectDue =
    journey !== null &&
    journeyDay >= 7 &&
    Math.floor(journeyDay / 7) > lastReflectedWeek;
  const journeyComplete =
    journey !== null && journeyDay >= 90 && journey.opened["90"] === true;

  function startJourney() {
    const v = (visionDraft.trim() || why).trim();
    if (!v || !sealDraft.trim()) return;
    if (v !== why) {
      localStorage.setItem("reset_why", v);
      setWhy(v);
    }
    const j: Journey = {
      start: startOfDay(new Date()).toISOString(),
      vision: v,
      seal: sealDraft.trim(),
      opened: {},
      cycle: (journey?.cycle ?? 0) + 1,
    };
    saveJourneyLS(j);
    setJourney(j);
    setVisionDraft("");
    setSealDraft("");
    setLastReflectedWeek(0);
    localStorage.setItem("reset_last_reflect_week", "0");
  }

  function unseal(day: number) {
    if (!journey) return;
    const j = {
      ...journey,
      opened: { ...journey.opened, [String(day)]: true },
    };
    saveJourneyLS(j);
    setJourney(j);
    setOpenSeal(null);
  }

  function restartCycle() {
    localStorage.removeItem("reset_journey");
    setVisionDraft(journey?.vision ?? why);
    setJourney(null);
  }

  async function submitReflection() {
    if (!journey) return;
    const wk = Math.floor(journeyDay / 7);
    setReflectLoading(true);
    const ai = await getWeeklyReflection(
      reflectAnswers,
      profile?.name ?? "",
      journey.vision,
      journeyWeek
    );
    setReflectAI(ai);
    setReflectLoading(false);
    setLastReflectedWeek(wk);
    localStorage.setItem("reset_last_reflect_week", String(wk));
    try {
      const arr = JSON.parse(
        localStorage.getItem("reset_reflections") || "[]"
      );
      arr.push({
        week: wk,
        answers: reflectAnswers,
        ai,
        date: new Date().toISOString(),
      });
      localStorage.setItem("reset_reflections", JSON.stringify(arr));
    } catch {}
  }

  const latestResetTime = latestEntry
    ? new Date(latestEntry.createdAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const hasResetToday = useMemo(
    () =>
      entries.some(
        (e) =>
          startOfDay(new Date(e.createdAt)).getTime() ===
          startOfDay(new Date()).getTime()
      ),
    [entries]
  );

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 100; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const has = entries.some(
        (e) =>
          e.status === "done" &&
          startOfDay(new Date(e.createdAt)).getTime() ===
            startOfDay(d).getTime()
      );
      if (has) s++;
      else break;
    }
    return s;
  }, [entries]);

  const trackerDays = useMemo(() => {
    const days: {
      label: string;
      active: boolean;
      isToday: boolean;
      presence?: number;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const dayEntries = entries.filter(
        (e) =>
          startOfDay(new Date(e.createdAt)).getTime() ===
          startOfDay(day).getTime()
      );
      const active = dayEntries.some((e) => e.status === "done");
      const presence = dayEntries[0]?.presenceScore;
      days.push({ label, active, isToday: i === 0, presence });
    }
    return days;
  }, [entries]);

  const patterns = useMemo(() => analyzePatterns(entries), [entries]);
  const milestoneLabel = getMilestoneLabel(streak);
  const isMilestone = milestoneLabel !== null;

  async function saveProfile() {
    setProfileError("");
    if (!profileName.trim()) {
      setProfileError("Name is required.");
      return;
    }
    const id = makeProfileId(profileName);
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id, name: profileName.trim() }, { onConflict: "id" })
      .select()
      .single();
    if (error) {
      setProfileError(error.message);
      return;
    }
    localStorage.setItem("reset_profile_id", id);
    if (whyDraft.trim()) {
      localStorage.setItem("reset_why", whyDraft.trim());
      setWhy(whyDraft.trim());
      setWhyDraft("");
    }
    setProfile(data as Profile);
    setScreen("arrival");
  }

  function changeName() {
    localStorage.removeItem("reset_profile_id");
    cancelLocalReminder();
    setProfile(null);
    setEntries([]);
    setProfileName("");
    setNotifEnabled(false);
    setScreen("profile");
  }

  function resetFlow() {
    setMind("");
    setAvoiding("");
    setMove("");
    setCountdown(COMMIT_SECONDS);
    setLatestId(null);
    setShareCopied(false);
    setShowResultPopup(false);
    setShowMilestone(false);
    setAiFeedback("");
    setMindReflection("");
    setMindReflectionLoading(false);
    setPatternFlash("");
    setShowPatternFlash(false);
    setFollowUpSeconds(null);
    setShowFollowUp(false);
    setFollowUpAnswer(null);
    setScreen(profile ? "start" : "profile");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
  }

  async function submitMind() {
    if (!mind.trim()) return;
    setMindReflection("");
    setMindReflectionLoading(true);
    setScreen("mindreflect");
    const reflection = await getMindReflection(mind, profile?.name ?? "");
    setMindReflection(reflection);
    setMindReflectionLoading(false);
  }

  async function saveResult(status: EntryStatus) {
    if (!profile) return;
    setAiFeedbackLoading(true);
    const pastPatterns = buildPastPatternsSummary(entries);
    const { data, error } = await supabase
      .from("entries")
      .insert({
        profile_id: profile.id,
        mind: mind.trim(),
        avoiding: avoiding.trim(),
        move: move.trim(),
        status,
        feedback: "...",
        presence_score: presenceScore || null,
      })
      .select()
      .single();
    if (error) {
      alert("The entry did not save. Check Supabase table or policies.");
      setAiFeedbackLoading(false);
      return;
    }
    const newEntry = mapEntry(data);
    const updatedEntries = [newEntry, ...entries].slice(0, 50);
    setEntries(updatedEntries);
    setLatestId(newEntry.id);
    setScreen("result");
    const newStreak = status === "done" ? streak + 1 : streak;
    if (status === "done") setFollowUpSeconds(300);
    if (status === "done" && MILESTONE_DAYS.includes(newStreak)) {
      setShowMilestone(true);
    } else {
      setShowResultPopup(true);
    }
    const isPatternFlashReset =
      updatedEntries.length >= 3 && updatedEntries.length % 3 === 0;
    if (isPatternFlashReset) {
      getPatternFlash(updatedEntries, profile.name).then((flash) => {
        if (flash) {
          setPatternFlash(flash);
          setShowPatternFlash(true);
        }
      });
    }
    const feedback = await getAIFeedback(
      status,
      mind,
      avoiding,
      move,
      profile.name,
      pastPatterns,
      presenceScore,
      why
    );
    setAiFeedback(feedback);
    setAiFeedbackLoading(false);
    await supabase.from("entries").update({ feedback }).eq("id", newEntry.id);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === newEntry.id ? { ...e, feedback } : e
      )
    );
  }

  async function toggleNotifications() {
    if (notifEnabled) {
      cancelLocalReminder();
      setNotifEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifPermission("granted");
      scheduleLocalReminder(profile?.name ?? "");
      setNotifEnabled(true);
    } else {
      setNotifPermission("denied");
    }
  }

  function resumeCheckin() {
    if (!checkinEntry) return;
    setMind(checkinEntry.mind);
    setAvoiding(checkinEntry.avoiding);
    setMove(checkinEntry.move);
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
  }

  function resumeLastNotYet() {
    if (!lastNotYet) return;
    setMind(lastNotYet.mind);
    setAvoiding(lastNotYet.avoiding);
    setMove(lastNotYet.move);
    setScreen("move");
  }

  async function shareMove() {
    const text = `I said I would do this: ${move}. Check on me.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Reset", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {}
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0A0807",
        }}
      >
        <style>{AVATAR_KEYFRAMES}</style>
        <div
          style={{
            fontSize: 13,
            color: "#6F6861",
            letterSpacing: "0.15em",
          }}
        >
          ...
        </div>
      </div>
    );
  }

  const S: Record<string, CSSProperties | any> = {
    page: { minHeight: "100vh", background: "#F5F1EA", padding: "0 0 40px" },
    wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px" },
    topRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 20,
      paddingBottom: 14,
    },
    badge: {
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#23201D",
    },
    profileBtn: {
      fontSize: 12,
      color: "#6F6861",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "4px 8px",
    },
    card: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 24,
      marginBottom: 14,
      boxShadow: "0 18px 50px rgba(35,32,29,0.06)",
    },
    progressWrap: {
      height: 3,
      background: "#E8E2D9",
      borderRadius: 999,
      marginBottom: 20,
      overflow: "hidden",
    },
    stepPill: {
      display: "inline-block",
      background: "#F7F1E6",
      border: "1px solid #DDD5CA",
      borderRadius: 999,
      padding: "5px 12px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#6F6861",
      marginBottom: 14,
    },
    stepPillDark: { background: "#23201D", color: "#F5F1EA", border: "none" },
    title: {
      fontSize: 28,
      lineHeight: 1.15,
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      marginBottom: 6,
      letterSpacing: "-0.03em",
      color: "#161413",
    },
    sub: {
      fontSize: 14,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 14,
    },
    subDark: { color: "#A79E93" },
    label: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#6F6861",
    },
    focusHint: {
      fontSize: 12,
      color: "#6F6861",
      marginBottom: 16,
      fontStyle: "italic",
    },
    boldHint: {
      fontSize: 12,
      color: "#B4611E",
      marginTop: -8,
      marginBottom: 16,
      fontStyle: "italic",
    },
    chips: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      padding: "7px 14px",
      borderRadius: 999,
      border: "1px solid #DDD5CA",
      background: "#F7F1E6",
      fontSize: 13,
      cursor: "pointer",
      color: "#4A4540",
      fontFamily: "inherit",
    },
    chipActive: {
      background: "#23201D",
      color: "#F5F1EA",
      border: "1px solid #23201D",
    },
    input: {
      width: "100%",
      padding: "13px 14px",
      borderRadius: 16,
      border: "1px solid #DDD5CA",
      background: "#F7F1E6",
      fontSize: 15,
      color: "#161413",
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box" as const,
      marginBottom: 8,
    },
    helperRow: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      color: "#736C64",
      marginBottom: 16,
    },
    helper: { fontSize: 12, color: "#736C64" },
    cta: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: "none",
      background: "linear-gradient(135deg, #D4521A 0%, #E06B30 100%)",
      color: "#FFF8F5",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
      marginBottom: 10,
      boxShadow: "0 4px 20px rgba(212,82,26,0.35)",
      transition: "all 0.2s ease",
    },
    ctaDisabled: { opacity: 0.38, cursor: "not-allowed" },
    ctaMuted: {
      width: "100%",
      padding: "13px 18px",
      borderRadius: 18,
      border: "1px solid #DDD5CA",
      background: "transparent",
      color: "#6F6861",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      marginBottom: 8,
    },
    ctaGold: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: "none",
      background: "linear-gradient(135deg, #D4A017 0%, #E8B830 100%)",
      color: "#FFF8E1",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 4px 20px rgba(212,160,23,0.4)",
    },
    trackerCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(35,32,29,0.05)",
    },
    trackerCardMilestone: {
      background:
        "linear-gradient(135deg,#FFF8E1 0%,#FFF3CC 50%,#FFFDF9 100%)",
      border: "1.5px solid #F0C040",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      animation: "goldPulse 2s ease-in-out infinite",
    },
    trackerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    streakPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "#23201D",
      color: "#F5F1EA",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 700,
    },
    streakPillMilestone: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "#E8A000",
      color: "#FFF8E1",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 700,
    },
    streakAtRiskPill: {
      display: "inline-block",
      background: "#8B1E1E",
      color: "#FFFDF9",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 700,
    },
    trackerRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 4,
      textAlign: "center" as const,
    },
    trackerDay: {
      fontSize: 10,
      color: "#6F6861",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 5,
    },
    trackerText: { fontSize: 12, color: "#6F6861" },
    dot: { width: 10, height: 10, borderRadius: "50%", background: "#E8E2D9" },
    dotActive: { background: "#23201D" },
    dotToday: {
      boxShadow: "0 0 0 2px #F5F1EA, 0 0 0 3.5px #23201D",
    },
    milestoneText: {
      fontSize: 13,
      color: "#B07A00",
      fontStyle: "italic",
      marginTop: 10,
      lineHeight: 1.5,
    },
    riskBanner: {
      background: "#1E0A0A",
      border: "1px solid #5C1F1F",
      borderRadius: 16,
      padding: "12px 16px",
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    riskText: {
      fontSize: 13,
      color: "#F5C0C0",
      lineHeight: 1.45,
      flex: 1,
    },
    riskButton: {
      padding: "8px 14px",
      borderRadius: 999,
      border: "none",
      background: "#8B1E1E",
      color: "#FFFDF9",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
    },
    recoveryBanner: {
      background: "#FFFDF9",
      border: "1px solid #C9D8CE",
      borderLeft: "3px solid #2E7D52",
      borderRadius: 16,
      padding: "13px 16px",
      marginBottom: 12,
    },
    recoveryTitle: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "#2E7D52",
      marginBottom: 4,
    },
    recoveryText: {
      fontSize: 13,
      color: "#4A4540",
      lineHeight: 1.55,
    },
    lensCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: "16px 18px",
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(35,32,29,0.05)",
    },
    lensTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    lensSource: {
      fontSize: 11,
      color: "#A79E93",
      fontStyle: "italic",
    },
    lensTag: {
      fontSize: 17,
      fontWeight: 500,
      color: "#23201D",
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      letterSpacing: "-0.02em",
      marginBottom: 4,
    },
    lensBody: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.55,
    },
    notifRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 16,
      padding: "12px 16px",
      marginBottom: 10,
    },
    notifLabel: { fontSize: 13, color: "#23201D", fontWeight: 600 },
    notifSub: { fontSize: 11, color: "#6F6861", marginTop: 2 },
    toggleTrack: (on: boolean): CSSProperties => ({
      width: 44,
      height: 26,
      borderRadius: 999,
      background: on ? "#23201D" : "#DDD5CA",
      position: "relative",
      cursor: "pointer",
      transition: "background 0.2s",
      flexShrink: 0,
    }),
    toggleThumb: (on: boolean): CSSProperties => ({
      position: "absolute",
      top: 3,
      left: on ? 21 : 3,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "#FFFDF9",
      transition: "left 0.2s",
      boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
    }),
    checkinCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 24,
      boxShadow: "0 18px 50px rgba(35,32,29,0.06)",
    },
    checkinBadge: {
      display: "inline-block",
      background: "#F7F1E6",
      border: "1px solid #DDD5CA",
      borderRadius: 999,
      padding: "5px 12px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#6F6861",
      marginBottom: 14,
    },
    checkinMove: {
      fontSize: 24,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      margin: "10px 0 6px",
      letterSpacing: "-0.03em",
    },
    heroCard: {
      position: "relative",
      minHeight: 520,
      borderRadius: 28,
      overflow: "hidden",
      marginBottom: 14,
      backgroundImage: "url('/garden.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    heroOverlay: {
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(180deg,rgba(245,241,234,0.08) 0%,rgba(35,32,29,0.72) 100%)",
      padding: "32px 28px",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "space-between",
    },
    heroTitle: {
      fontSize: 38,
      fontWeight: 500,
      lineHeight: 1.1,
      letterSpacing: "-0.04em",
      color: "#F5F1EA",
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      whiteSpace: "pre-line" as const,
      marginBottom: 10,
    },
    heroSub: {
      fontSize: 15,
      color: "rgba(245,241,234,0.72)",
      lineHeight: 1.5,
      maxWidth: 260,
    },
    heroBottom: { maxWidth: 320 },
    startButton: {
      width: "100%",
      padding: "18px 20px",
      borderRadius: 20,
      border: "none",
      background: "linear-gradient(135deg, #D4521A 0%, #E06B30 100%)",
      color: "#FFF8F5",
      fontSize: 16,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
      marginBottom: 10,
      boxShadow: "0 6px 28px rgba(212,82,26,0.5)",
      letterSpacing: "0.01em",
    },
    heroFoot: {
      fontSize: 12,
      color: "rgba(245,241,234,0.5)",
      textAlign: "center" as const,
      marginTop: 8,
    },
    unfinishedCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: 18,
      marginBottom: 12,
    },
    unfinishedMove: {
      fontSize: 20,
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      marginBottom: 4,
      letterSpacing: "-0.02em",
    },
    commitCard: {
      background: "#0E0C0A",
      border: "1px solid #2A2520",
    },
    moveBox: {
      background: "rgba(245,241,234,0.05)",
      borderRadius: 16,
      padding: "16px 18px",
      marginBottom: 24,
      border: "1px solid rgba(245,241,234,0.07)",
    },
    moveBig: {
      fontSize: 26,
      fontWeight: 500,
      lineHeight: 1.2,
      color: "#F5F1EA",
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      letterSpacing: "-0.03em",
    },
    moveWhy: {
      fontSize: 12,
      color: "rgba(245,241,234,0.38)",
      marginTop: 10,
      fontStyle: "italic",
      lineHeight: 1.45,
    },
    statusRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    statusPrimary: {
      padding: "14px 10px",
      borderRadius: 16,
      border: "none",
      background: "#F5F1EA",
      color: "#161413",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    statusSecondary: {
      padding: "14px 10px",
      borderRadius: 16,
      border: "1px solid rgba(245,241,234,0.2)",
      background: "transparent",
      color: "rgba(245,241,234,0.6)",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    aiFeedbackBox: {
      background: "#F0EDE6",
      border: "1px solid #C8BFB4",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 14,
    },
    aiBadge: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      color: "#8A7F74",
      marginBottom: 6,
    },
    feedbackText: { fontSize: 14, color: "#2B2723", lineHeight: 1.6 },
    resultBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 16,
      padding: "12px 14px",
      marginBottom: 14,
    },
    shareBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 14,
    },
    shareTitle: { fontSize: 13, fontWeight: 700, marginBottom: 5 },
    shareText: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 11,
    },
    historyList: { display: "grid", gap: 10 },
    historyCard: {
      padding: 14,
      borderRadius: 16,
      border: "1px solid #E8E2D9",
      background: "#FDFAF6",
    },
    historyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 9,
      flexWrap: "wrap" as const,
    },
    historyDate: { fontSize: 12, color: "#6F6861" },
    historyLine: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "#161413",
      marginBottom: 5,
    },
    historyLineLabel: { fontWeight: 700, color: "#6F6861" },
    emptyState: {
      textAlign: "center" as const,
      padding: "32px 16px",
      color: "#6F6861",
      fontSize: 14,
    },
    statusBadge: (s: EntryStatus): CSSProperties => ({
      fontSize: 11,
      fontWeight: 700,
      padding: "3px 9px",
      borderRadius: 999,
      background: s === "done" ? "#E8F5E9" : "#FFF3E0",
      color: s === "done" ? "#2E7D32" : "#E65100",
    }),
    insightRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 16,
    },
    insightIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
    insightTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: "#23201D",
      marginBottom: 3,
    },
    insightBody: { fontSize: 13, color: "#6F6861", lineHeight: 1.5 },
    summaryGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 16,
    },
    summaryBox: {
      background: "#F7F3EC",
      border: "1px solid #E8E2D9",
      borderRadius: 16,
      padding: 12,
    },
    summaryBoxGold: {
      background: "rgba(232,160,0,0.1)",
      border: "1px solid rgba(232,160,0,0.3)",
      borderRadius: 16,
      padding: 12,
    },
    summaryNum: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    summaryNumGold: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: "-0.04em",
      color: "#7A5200",
    },
    summaryLabel: {
      fontSize: 11,
      color: "#6F6861",
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      marginTop: 3,
    },
    summaryLabelGold: {
      fontSize: 11,
      color: "#9A7000",
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      marginTop: 3,
    },
    modalBackdrop: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(18,17,15,0.6)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      padding: "0 16px 32px",
      zIndex: 100,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      background: "#FFFDF9",
      borderRadius: 28,
      overflow: "hidden",
      border: "1px solid #DDD5CA",
      boxShadow: "0 25px 80px rgba(18,17,15,0.28)",
    },
    modalCardGold: {
      width: "100%",
      maxWidth: 420,
      background: "linear-gradient(160deg,#FFF8E1 0%,#FFF3CC 100%)",
      borderRadius: 28,
      overflow: "hidden",
      border: "2px solid #E8A000",
      boxShadow: "0 25px 80px rgba(232,160,0,0.3)",
    },
    modalImage: {
      height: 190,
      backgroundImage:
        "linear-gradient(rgba(245,241,234,0.12),rgba(245,241,234,0.55)),url('/garden.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    modalImageGold: {
      height: 190,
      background:
        "linear-gradient(135deg,#E8A000 0%,#F5C842 50%,#E8A000 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 72,
    },
    modalBody: { padding: 22 },
    modalTitle: {
      fontSize: 34,
      lineHeight: 1,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      marginBottom: 8,
    },
    modalTitleGold: {
      fontSize: 34,
      lineHeight: 1,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
      marginBottom: 8,
      color: "#7A5200",
    },
    modalText: {
      fontSize: 14,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 16,
    },
    modalTextGold: {
      fontSize: 15,
      color: "#8B6300",
      lineHeight: 1.5,
      marginBottom: 16,
      fontStyle: "italic",
    },
    modalDate: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 10,
      padding: "8px 12px",
      fontSize: 12,
      color: "#6F6861",
      marginBottom: 14,
    },
    footer: {
      textAlign: "center" as const,
      fontSize: 12,
      color: "#A79E93",
      marginTop: 32,
      paddingBottom: 16,
    },
  };

  function renderStepCard(step: 1 | 2 | 3, content: React.ReactNode) {
    const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
    return (
      <div style={S.card}>
        <div style={S.progressWrap}>
          <div style={progressBarStyle(pct)} />
        </div>
        {content}
      </div>
    );
  }

  if (screen === "onboarding") {
    return <OnboardingScreen onFinish={() => setScreen("profile")} />;
  }

  // ── ARRIVAL SCREEN — avatar is the centrepiece ─────────────────────────
  if (screen === "arrival") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0807",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{`
          ${AVATAR_KEYFRAMES}
          @keyframes arrivalFadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes arrivalBgPulse {
            0%, 100% { opacity: 0.04; transform: scale(1); }
            50%       { opacity: 0.1; transform: scale(1.25); }
          }
        `}</style>

        {/* Deep background wash */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(212,82,26,0.14) 0%, rgba(10,8,7,0) 65%)",
            pointerEvents: "none",
          }}
        />
        {/* Ambient BG orb */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 600,
              height: 600,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(212,82,26,0.1) 0%, transparent 65%)",
              animation: "arrivalBgPulse 10s ease-in-out infinite",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(245,241,234,0.22)",
            marginBottom: 52,
            animation: "arrivalFadeUp 1s ease forwards",
            position: "relative",
            zIndex: 1,
          }}
        >
          Reset
        </div>

        {/* The Avatar — breathing */}
        <div
          style={{
            marginBottom: 36,
            animation: "arrivalFadeUp 0.8s ease 0.2s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <CalmAvatar phase={breathePhase} size={160} accentHex="#D4521A" />
        </div>

        {/* Breathe label */}
        <div
          style={{
            fontSize: 12,
            color: "rgba(245,241,234,0.4)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 18,
            animation: "arrivalFadeUp 1s ease 0.4s both",
            transition: "opacity 0.8s ease",
            position: "relative",
            zIndex: 1,
          }}
        >
          {breathePhase === "in" ? "Breathe in" : "Breathe out"}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: "rgba(245,241,234,0.88)",
            fontFamily:
              'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
            letterSpacing: "-0.03em",
            textAlign: "center",
            lineHeight: 1.3,
            marginBottom: 10,
            maxWidth: 280,
            animation: "arrivalFadeUp 1.2s ease 0.6s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          Stop. Breathe.{"\n"}You're already here.
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(245,241,234,0.4)",
            textAlign: "center",
            marginBottom: 8,
            position: "relative",
            zIndex: 1,
            animation: "arrivalFadeUp 1.2s ease 0.7s both",
          }}
        >
          قِف. تنفّس. أنت هنا.
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(245,241,234,0.28)",
            textAlign: "center",
            marginBottom: 56,
            fontStyle: "italic",
            position: "relative",
            zIndex: 1,
            letterSpacing: "0.04em",
          }}
        >
          Three minutes. One move. Done.
        </div>

        <button
          onClick={() => setScreen("presence")}
          disabled={!arrivalUnlocked}
          style={{
            padding: "14px 36px",
            borderRadius: 999,
            border: `1px solid ${
              arrivalUnlocked
                ? "rgba(180,120,50,0.35)"
                : "rgba(245,241,234,0.08)"
            }`,
            background: arrivalUnlocked
              ? "rgba(180,120,50,0.12)"
              : "transparent",
            color: arrivalUnlocked
              ? "rgba(245,241,234,0.85)"
              : "rgba(245,241,234,0.18)",
            fontSize: 14,
            cursor: arrivalUnlocked ? "pointer" : "default",
            fontFamily: "inherit",
            letterSpacing: "0.06em",
            transition: "all 1s ease",
            position: "relative",
            zIndex: 1,
            boxShadow: arrivalUnlocked
              ? "0 0 24px rgba(180,120,50,0.1)"
              : "none",
          }}
        >
          {arrivalUnlocked ? "I'm here" : "Breathe..."}
        </button>
      </div>
    );
  }

  // ── PRESENCE SCREEN — avatar tints to match score ─────────────────────
  if (screen === "presence") {
    // Avatar accent color based on selected score
    const presenceAccents: Record<number, string> = {
      1: "#C0392B",
      2: "#D4630A",
      3: "#B8940A",
      4: "#2E7D52",
      5: "#1A5276",
    };
    const avatarAccent =
      presenceScore > 0 ? presenceAccents[presenceScore] : "#B47832";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0807",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{`
          ${AVATAR_KEYFRAMES}
          @keyframes pFadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pBgPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.6; }
          }
        `}</style>

        {/* Dynamic background wash matching presence color */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              presenceScore > 0
                ? `radial-gradient(ellipse at 50% 30%, ${avatarAccent}18 0%, transparent 60%)`
                : "transparent",
            transition: "background 0.8s ease",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            width: "100%",
            maxWidth: 400,
            animation: "pFadeUp 0.6s ease forwards",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Avatar */}
          <div style={{ marginBottom: 28 }}>
            <CalmAvatar
              phase="reflect"
              size={90}
              accentHex={avatarAccent}
            />
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(245,241,234,0.25)",
              marginBottom: 20,
            }}
          >
            Reset
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "rgba(245,241,234,0.9)",
              fontFamily:
                'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1.3,
              marginBottom: 8,
            }}
          >
            How present are you{"\n"}right now?
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(245,241,234,0.28)",
              textAlign: "center",
              marginBottom: 36,
              letterSpacing: "0.04em",
            }}
          >
            Be honest. No one's watching.
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 36, width: "100%" }}>
            {[1, 2, 3, 4, 5].map((score) => {
              const info = PRESENCE_LABELS[score];
              const selected = presenceScore === score;
              return (
                <button
                  key={score}
                  onClick={() => setPresenceScore(score)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    borderRadius: 16,
                    border: selected
                      ? `1px solid ${info.color}66`
                      : "1px solid rgba(245,241,234,0.07)",
                    background: selected
                      ? `${info.color}20`
                      : "rgba(245,241,234,0.02)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.22s ease",
                    boxShadow: selected
                      ? `0 0 24px ${info.color}20, inset 0 0 0 1px ${info.color}22`
                      : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: selected ? info.color : "rgba(245,241,234,0.15)",
                      boxShadow: selected ? `0 0 10px ${info.color}` : "none",
                      transition: "all 0.22s ease",
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{
                        fontSize: 14,
                        color: selected ? "rgba(245,241,234,0.95)" : "rgba(245,241,234,0.45)",
                        fontWeight: selected ? 600 : 400,
                        transition: "all 0.22s ease",
                        lineHeight: 1.2,
                      }}>{info.en}</div>
                      {selected && (
                        <div style={{
                          fontSize: 11,
                          color: `${info.color}CC`,
                          marginTop: 2,
                          transition: "all 0.3s ease",
                        }}>{info.sub}</div>
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: selected ? info.color : "rgba(245,241,234,0.15)",
                    transition: "color 0.22s ease",
                    letterSpacing: "0.05em",
                  }}>{score}/5</div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => presenceScore > 0 && setScreen("start")}
            disabled={presenceScore === 0}
            style={{
              width: "100%",
              padding: "15px 18px",
              borderRadius: 18,
              border: "none",
              background:
                presenceScore > 0
                  ? "rgba(245,241,234,0.92)"
                  : "rgba(245,241,234,0.08)",
              color:
                presenceScore > 0 ? "#161413" : "rgba(245,241,234,0.25)",
              fontSize: 15,
              fontWeight: 800,
              cursor: presenceScore > 0 ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "all 0.3s ease",
              boxShadow:
                presenceScore > 0
                  ? "0 8px 24px rgba(245,241,234,0.12)"
                  : "none",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── MIND REFLECTION SCREEN — avatar in "reflect" mode ─────────────────
  if (screen === "mindreflect") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0807",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{`
          ${AVATAR_KEYFRAMES}
          @keyframes reflectBg {
            0%, 100% { opacity: 0.06; transform: scale(1); }
            50%       { opacity: 0.12; transform: scale(1.2); }
          }
          @keyframes fadeUpSlow {
            from { opacity: 0; transform: translateY(22px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes dotPulse {
            0%,80%,100% { opacity: 0.2; transform: scale(0.8); }
            40%          { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Background */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 520,
              height: 520,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(212,82,26,0.12) 0%, transparent 70%)",
              animation: "reflectBg 12s ease-in-out infinite",
            }}
          />
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 380,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(245,241,234,0.18)",
              marginBottom: 44,
            }}
          >
            Reset
          </div>

          {/* Avatar in reflect mode */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 32,
              animation: "fadeUpSlow 0.6s ease forwards",
            }}
          >
            <CalmAvatar phase="reflect" size={100} accentHex="#D4521A" />
          </div>

          {/* What they typed */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(245,241,234,0.2)",
              marginBottom: 14,
            }}
          >
            On your mind
          </div>
          <div
            style={{
              fontSize: 17,
              color: "rgba(245,241,234,0.5)",
              fontFamily:
                'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              fontStyle: "italic",
              lineHeight: 1.45,
              marginBottom: 40,
              padding: "0 8px",
            }}
          >
            "{mind}"
          </div>

          {/* The reflection */}
          <div
            style={{
              minHeight: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 52,
              padding: "0 4px",
            }}
          >
            {mindReflectionLoading ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "rgba(180,120,50,0.6)",
                      animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  lineHeight: 1.38,
                  color: "rgba(245,241,234,0.9)",
                  fontFamily:
                    'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                  letterSpacing: "-0.02em",
                  animation: "fadeUpSlow 0.8s ease forwards",
                }}
              >
                {mindReflection}
              </div>
            )}
          </div>

          {!mindReflectionLoading && mindReflection && (
            <button
              onClick={() => setScreen("avoid")}
              style={{
                padding: "15px 42px",
                borderRadius: 999,
                border: "1px solid rgba(180,120,50,0.28)",
                background: "rgba(180,120,50,0.1)",
                color: "rgba(245,241,234,0.8)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                transition: "all 0.3s ease",
                animation: "fadeUpSlow 0.6s ease 0.3s both",
                boxShadow: "0 0 20px rgba(180,120,50,0.08)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(180,120,50,0.18)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(245,241,234,0.95)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(180,120,50,0.1)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(245,241,234,0.8)";
              }}
            >
              Keep going →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "pulse") {
    return (
      <div style={S.page}>
        <style>{`
          @keyframes pulseLive { 0%,100%{opacity:1} 50%{opacity:0.4} }
          button:active { transform: scale(0.98); }
        `}</style>
        <div style={S.wrap}>
          <div style={S.topRow}>
            <div style={S.badge}>Reset</div>
            {profile && (
              <button style={S.profileBtn} onClick={() => setScreen("start")}>
                ← Home
              </button>
            )}
          </div>
          <PulseScreen onBack={() => setScreen("start")} />
          <div style={S.footer}>Stop thinking. Start moving.</div>
        </div>
      </div>
    );
  }

  // ── MAIN APP RETURN ────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        ${AVATAR_KEYFRAMES}
        @keyframes goldPulse {
          0%,100% { box-shadow: 0 14px 40px rgba(240,192,64,0.18); }
          50%      { box-shadow: 0 14px 55px rgba(240,192,64,0.38); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseLive {
          0%,100%{opacity:1} 50%{opacity:0.4}
        }
        @keyframes commitAvatarReveal {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        button:active { transform: scale(0.98); }
      `}</style>
      <div style={S.wrap}>
        <div style={S.topRow}>
          <div style={S.badge}>Reset</div>
          <div style={{ display: "flex", gap: 8 }}>
            {profile && entries.length >= 3 && (
              <button
                style={S.profileBtn}
                onClick={() => setScreen("insights")}
              >
                Insights
              </button>
            )}
            {profile && (
              <button style={S.profileBtn} onClick={changeName}>
                {profile.name} ↩
              </button>
            )}
          </div>
        </div>

        {screen === "start" && presenceScore > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: PRESENCE_LABELS[presenceScore]?.color,
                boxShadow: `0 0 6px ${PRESENCE_LABELS[presenceScore]?.color}`,
              }}
            />
            <span style={{ fontSize: 12, color: "#6F6861" }}>
              Today: {PRESENCE_LABELS[presenceScore]?.en} — {PRESENCE_LABELS[presenceScore]?.sub}
            </span>
          </div>
        )}

        {screen !== "profile" && (
          <div
            style={
              isMilestone ? S.trackerCardMilestone : S.trackerCard
            }
          >
            <div style={S.trackerTop}>
              <div>
                <div style={S.label}>Momentum</div>
                <div style={{ ...S.trackerText, marginTop: 3 }}>
                  {streak > 0
                    ? `${streak} day${streak !== 1 ? "s" : ""} strong`
                    : "Start today"}
                </div>
              </div>
              {streakAtRisk && !hasResetToday ? (
                <div style={S.streakAtRiskPill}>⚠ Streak at risk</div>
              ) : isMilestone ? (
                <div style={S.streakPillMilestone}>★ {streak} day streak</div>
              ) : streak > 1 ? (
                <div style={S.streakPill}>{streak} day streak</div>
              ) : (
                <div style={S.trackerText}>Last 7 days</div>
              )}
            </div>
            <div style={S.trackerRow}>
              {trackerDays.map((day, idx) => (
                <div
                  key={`${day.label}-${idx}`}
                  style={S.trackerDay}
                >
                  <div
                    style={{
                      ...S.dot,
                      ...(day.active ? S.dotActive : {}),
                      ...(day.isToday ? S.dotToday : {}),
                    }}
                  />
                  {day.label}
                </div>
              ))}
            </div>
            {isMilestone && (
              <div style={S.milestoneText}>{milestoneLabel}</div>
            )}
          </div>
        )}

        {screen === "start" && streakAtRisk && !hasResetToday && (
          <div style={S.riskBanner}>
            <div style={S.riskText}>
              You had a streak going. You haven't moved today. One reset keeps
              it alive.
            </div>
            <button
              style={S.riskButton}
              onClick={() => setScreen("mind")}
            >
              Don't break it
            </button>
          </div>
        )}

        {screen === "start" && needsRecovery && (
          <div style={S.recoveryBanner}>
            <div style={S.recoveryTitle}>Recovery check</div>
            <div style={S.recoveryText}>
              Your last few arrivals were scattered. Recovery is a strategy,
              not a reward — make today's move half-size, and protect tonight's
              sleep like it's part of the work. Because it is.
            </div>
          </div>
        )}

        {screen === "checkin" && checkinEntry && (
          <div style={S.checkinCard}>
            <div style={S.checkinBadge}>Daily Check-in</div>
            <div style={S.title}>Yesterday you said "not yet."</div>
            <div style={S.sub}>You said you'd do this:</div>
            <div style={S.checkinMove}>{checkinEntry.move}</div>
            <div style={{ ...S.sub, marginBottom: 20 }}>
              Did it happen? Or are you still carrying it?
            </div>
            <button style={S.cta} onClick={resumeCheckin}>
              Commit to it now
            </button>
            <button
              style={S.ctaMuted}
              onClick={() => setScreen("start")}
            >
              Start fresh instead
            </button>
          </div>
        )}

        {screen === "profile" && (
          <div style={S.card}>
            <div style={S.stepPill}>Name</div>
            <div style={S.title}>What do people call you?</div>
            <div style={S.sub}>
              Just your first name. This stays on your device.
            </div>
            <input
              style={S.input}
              placeholder="Your name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveProfile()}
            />
            <div style={{ ...S.sub, marginTop: 10, marginBottom: 6 }}>
              And one line — what is all of this in service of? (optional)
            </div>
            <input
              style={S.input}
              placeholder="e.g. A life I run, not one that runs me"
              value={whyDraft}
              maxLength={80}
              onChange={(e) => setWhyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveProfile()}
            />
            {profileError && (
              <div
                style={{
                  color: "#C0392B",
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                {profileError}
              </div>
            )}
            <button
              style={{ ...S.cta, marginTop: 18 }}
              onClick={saveProfile}
            >
              Start
            </button>
          </div>
        )}

        {screen === "start" && !journey && (
          <div style={S.card}>
            <div style={S.stepPill}>Day 0</div>
            <div style={S.title}>90 days. One move a day.</div>
            <div style={S.sub}>
              Set your vision once. Then it's just today's 1% — every day.
              At day 30, 60 and 90 a sealed message from you opens, but only
              if you've earned it.
            </div>
            <div style={{ ...S.label, marginBottom: 6 }}>Your vision</div>
            <input
              style={S.input}
              placeholder={why || "Where are you on day 90?"}
              value={visionDraft}
              maxLength={100}
              onChange={(e) => setVisionDraft(e.target.value)}
            />
            <div style={{ ...S.label, margin: "10px 0 6px" }}>
              Seal a message to future you
            </div>
            <input
              style={S.input}
              placeholder="You'll read this on day 30 — if you earn it"
              value={sealDraft}
              maxLength={200}
              onChange={(e) => setSealDraft(e.target.value)}
            />
            <div style={{ ...S.helper, marginBottom: 14 }}>
              Locked until you've done {sealTarget(30)}+ moves. No early opens.
            </div>
            <button
              style={{
                ...S.cta,
                ...((visionDraft.trim() || why) && sealDraft.trim()
                  ? {}
                  : S.ctaDisabled),
              }}
              disabled={!(visionDraft.trim() || why) || !sealDraft.trim()}
              onClick={startJourney}
            >
              Start my 90 days
            </button>
          </div>
        )}

        {screen === "start" && journey && (
          <>
            <div style={S.trackerCard}>
              <div style={S.trackerTop}>
                <div>
                  <div style={S.label}>Cycle {journey.cycle}</div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 500,
                      fontFamily:
                        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                      letterSpacing: "-0.04em",
                      color: "#161413",
                      lineHeight: 1.1,
                      marginTop: 2,
                    }}
                  >
                    Day {journeyDay} of 90
                  </div>
                </div>
                {nextSeal !== null && (
                  <div
                    style={{
                      fontSize: 11,
                      color: sealReady ? "#7A5200" : "#6F6861",
                      textAlign: "right",
                      fontWeight: sealReady ? 700 : 400,
                    }}
                  >
                    {sealReady
                      ? `Seal ${nextSeal} earned ★`
                      : `Next seal: day ${nextSeal}`}
                    <br />
                    {doneInJourney}/{sealTarget(nextSeal)} moves
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#6F6861",
                  fontStyle: "italic",
                  marginBottom: 12,
                }}
              >
                Vision: {journey.vision}
              </div>
              <div
                style={{
                  height: 6,
                  background: "#E8E2D9",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((journeyDay / 90) * 100)}%`,
                    background:
                      "linear-gradient(90deg, #D4521A 0%, #E06B30 100%)",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              {sealReady && nextSeal !== null && (
                <button
                  style={{ ...S.ctaGold, marginTop: 14 }}
                  onClick={() => setOpenSeal(nextSeal)}
                >
                  Open your day-{nextSeal} seal
                </button>
              )}
              {journeyComplete && (
                <button
                  style={{ ...S.cta, marginTop: 14 }}
                  onClick={restartCycle}
                >
                  Cycle {journey.cycle} complete — start the next 90
                </button>
              )}
            </div>

            {reflectDue && (
              <div style={S.unfinishedCard}>
                <div style={S.label}>Week {journeyWeek} reflection</div>
                <div style={{ ...S.trackerText, margin: "6px 0 12px" }}>
                  Two minutes. Look back at the week, then aim the next one.
                </div>
                <button
                  style={{ ...S.cta, marginBottom: 0 }}
                  onClick={() => {
                    setReflectAnswers(["", "", ""]);
                    setReflectAI("");
                    setScreen("reflect");
                  }}
                >
                  Reflect now
                </button>
              </div>
            )}

            <div style={S.heroCard}>
              <div style={S.heroOverlay}>
                {/* Small ambient avatar top-right of hero */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 4,
                  }}
                >
                  <CalmAvatar phase="still" size={56} accentHex="#D4A850" />
                </div>
                <div>
                  <div style={S.heroTitle}>{getTimeBasedHero().title}</div>
                  <div style={S.heroSub}>{getTimeBasedHero().sub}</div>
                </div>
                <div style={S.heroBottom}>
                  <button
                    style={S.startButton}
                    onClick={() => setScreen("mind")}
                  >
                    {hasResetToday ? "Reset again" : "Start Reset"}
                  </button>
                  <div style={S.heroFoot}>
                    This is saved to your reset record.
                  </div>
                </div>
              </div>
            </div>

            {/* ── DAILY LENS — one principle a day ── */}
            <div style={S.lensCard}>
              <div style={S.lensTop}>
                <div style={S.label}>Today's lens</div>
                <div style={S.lensSource}>{lens.source}</div>
              </div>
              <div style={S.lensTag}>{lens.tag}</div>
              <div style={S.lensBody}>{lens.body}</div>
            </div>

            {/* ── WHY CAPTURE — shown once, until saved ── */}
            {!why && (
              <div style={S.trackerCard}>
                <div style={S.label}>Your why</div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6F6861",
                    margin: "6px 0 10px",
                    lineHeight: 1.5,
                  }}
                >
                  One line: what is all of this in service of? It shows up
                  every time you commit.
                </div>
                <input
                  style={S.input}
                  placeholder="e.g. A life I run, not one that runs me"
                  value={whyDraft}
                  maxLength={80}
                  onChange={(e) => setWhyDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveWhy()}
                />
                <button
                  style={{
                    ...S.ctaMuted,
                    marginBottom: 0,
                    ...(whyDraft.trim() ? {} : S.ctaDisabled),
                  }}
                  disabled={!whyDraft.trim()}
                  onClick={saveWhy}
                >
                  Save my why
                </button>
              </div>
            )}

            <PulseTeaser onExpand={() => setScreen("pulse")} />

            {lastNotYet && !hasResetToday && (
              <div style={S.unfinishedCard}>
                <div style={S.label}>Unfinished business</div>
                <div style={S.unfinishedMove}>{lastNotYet.move}</div>
                <div style={S.trackerText}>
                  You said "not yet." Respectfully, the task is still staring.
                </div>
                <button
                  style={{ ...S.cta, marginTop: 12 }}
                  onClick={resumeLastNotYet}
                >
                  Resume
                </button>
              </div>
            )}
            <div style={S.notifRow}>
              <div>
                <div style={S.notifLabel}>Daily reminder at noon</div>
                <div style={S.notifSub}>
                  {notifPermission === "denied"
                    ? "Blocked in browser settings"
                    : notifEnabled
                    ? "You'll get a nudge if you haven't moved"
                    : "Off — tap to enable"}
                </div>
              </div>
              <div
                style={S.toggleTrack(notifEnabled)}
                onClick={
                  notifPermission !== "denied"
                    ? toggleNotifications
                    : undefined
                }
                role="switch"
                aria-checked={notifEnabled}
              >
                <div style={S.toggleThumb(notifEnabled)} />
              </div>
            </div>
            <button
              style={S.ctaMuted}
              onClick={() => setScreen("history")}
            >
              View history
            </button>
          </>
        )}

        {screen === "mind" &&
          renderStepCard(
            1,
            <>
              <div style={S.stepPill}>Step 1 / 3</div>
              <div style={S.title}>What's actually in your head?</div>
              <div style={S.sub}>Not everything. Just the loudest thing.</div>
              <div style={S.focusHint}>
                If you over-explain, you're avoiding.
              </div>
              <div style={S.chips}>
                {MIND_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{
                      ...S.chip,
                      ...(mind === opt ? S.chipActive : {}),
                    }}
                    onClick={() => setMind(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                ref={mindRef}
                style={S.input}
                placeholder="The loudest thing right now…"
                value={mind}
                maxLength={120}
                onChange={(e) => setMind(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && mind.trim() && submitMind()
                }
              />
              <div style={S.helperRow}>
                <span style={S.helper}>Be specific. Vague = stuck.</span>
                <span style={S.helper}>{mind.length}/120</span>
              </div>
              <button
                style={{
                  ...S.cta,
                  ...(mind.trim() ? {} : S.ctaDisabled),
                }}
                disabled={!mind.trim()}
                onClick={submitMind}
              >
                That's it. Continue.
              </button>
              <button style={S.ctaMuted} onClick={resetFlow}>
                Cancel
              </button>
            </>
          )}

        {screen === "avoid" &&
          renderStepCard(
            2,
            <>
              <div style={S.stepPill}>Step 2 / 3</div>
              <div style={S.title}>What are you avoiding?</div>
              <div style={{ ...S.sub, marginBottom: 6 }}>
                Not the story. The thing itself.
              </div>
              {mind && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#A79E93",
                    fontStyle: "italic",
                    marginBottom: 14,
                    padding: "8px 12px",
                    background: "#F7F3EC",
                    borderRadius: 10,
                    borderLeft: "2px solid #DDD5CA",
                  }}
                >
                  You said: "{mind}"
                </div>
              )}
              <div style={S.focusHint}>
                If you soften it, you'll keep avoiding it.
              </div>
              <div style={S.chips}>
                {AVOIDING_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{
                      ...S.chip,
                      ...(avoiding === opt ? S.chipActive : {}),
                    }}
                    onClick={() => setAvoiding(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                ref={avoidRef}
                style={S.input}
                placeholder="What you keep not doing…"
                value={avoiding}
                maxLength={120}
                onChange={(e) => setAvoiding(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && avoiding.trim() && setScreen("move")
                }
              />
              <div style={S.helperRow}>
                <span style={S.helper}>Name it exactly.</span>
                <span style={S.helper}>{avoiding.length}/120</span>
              </div>
              <button
                style={{
                  ...S.cta,
                  ...(avoiding.trim() ? {} : S.ctaDisabled),
                }}
                disabled={!avoiding.trim()}
                onClick={() => setScreen("move")}
              >
                Got it. Next.
              </button>
              <button
                style={S.ctaMuted}
                onClick={() => setScreen("mind")}
              >
                ← Back
              </button>
            </>
          )}

        {screen === "move" &&
          renderStepCard(
            3,
            <>
              <div style={S.stepPill}>Step 3 / 3</div>
              <div style={S.title}>What's the smallest move?</div>
              <div style={S.sub}>Not the plan. Just the first step.</div>
              <div style={S.focusHint}>
                If it feels big, you won't do it.
              </div>
              {presenceScore >= 4 && (
                <div style={S.boldHint}>
                  You arrived steady today. Pick the version that scares you a
                  little.
                </div>
              )}
              {needsRecovery && (
                <div style={{ ...S.boldHint, color: "#2E7D52" }}>
                  You've been running low. Make it half the size you think it
                  should be.
                </div>
              )}
              <div style={S.chips}>
                {MOVE_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{
                      ...S.chip,
                      ...(move === opt ? S.chipActive : {}),
                    }}
                    onClick={() => setMove(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                ref={moveRef}
                style={S.input}
                placeholder="One tiny action…"
                value={move}
                maxLength={120}
                onChange={(e) => setMove(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && move.trim() && beginCommit()
                }
              />
              <div style={S.helperRow}>
                <span style={S.helper}>Embarrassingly small is right.</span>
                <span style={S.helper}>{move.length}/120</span>
              </div>
              <button
                style={{
                  ...S.cta,
                  ...(move.trim() ? {} : S.ctaDisabled),
                }}
                disabled={!move.trim()}
                onClick={beginCommit}
              >
                Commit.
              </button>
              <button
                style={S.ctaMuted}
                onClick={() => setScreen("avoid")}
              >
                ← Back
              </button>
            </>
          )}

        {/* ── COMMIT SCREEN — avatar breathes with countdown ── */}
        {screen === "commit" && (
          <div style={{ ...S.card, ...S.commitCard }}>
            <div style={{ ...S.stepPill, ...S.stepPillDark }}>
              Just do it.
            </div>
            <div
              style={{
                ...S.title,
                color: "rgba(245,241,234,0.88)",
              }}
            >
              Do it. Right now.
            </div>
            <div style={{ ...S.sub, ...S.subDark }}>
              Not when you feel ready. Now.
            </div>
            <div style={S.moveBox}>
              <div
                style={{
                  ...S.label,
                  color: "#A79E93",
                  marginBottom: 8,
                }}
              >
                Your move
              </div>
              <div style={S.moveBig}>{move}</div>
              {why && (
                <div style={S.moveWhy}>In service of: {why}</div>
              )}
            </div>
            {countdown > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0,
                  position: "relative",
                }}
              >
                {/* Avatar replaces the simple ring */}
                <div
                  style={{
                    animation: "commitAvatarReveal 0.6s ease forwards",
                    position: "relative",
                  }}
                >
                  <CalmAvatar
                    phase={breathePhase}
                    size={110}
                    accentHex="#D4521A"
                  />
                  {/* Countdown number overlaid on avatar */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 800,
                        color: "rgba(245,241,234,0.92)",
                        letterSpacing: "-0.05em",
                        fontFamily:
                          'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                        textShadow: "0 0 20px rgba(180,120,50,0.5)",
                      }}
                    >
                      {countdown}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(245,241,234,0.35)",
                    textAlign: "center",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    marginTop: 12,
                  }}
                >
                  {breathePhase === "in" ? "Breathe in" : "Breathe out"}
                </div>
              </div>
            ) : (
              <div style={S.statusRow}>
                <button
                  style={S.statusPrimary}
                  onClick={() => saveResult("done")}
                >
                  I did it
                </button>
                <button
                  style={S.statusSecondary}
                  onClick={() => saveResult("not_yet")}
                >
                  I didn't
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && latestEntry && (
          <div style={S.card}>
            <div style={S.stepPill}>Feedback</div>
            <div style={S.title}>
              {latestEntry.status === "done"
                ? "You moved."
                : "Not yet. That's data."}
            </div>
            <div style={S.aiFeedbackBox}>
              <div style={S.aiBadge}>AI Insight</div>
              {aiFeedbackLoading ? (
                <div
                  style={{
                    ...S.feedbackText,
                    color: "#A79E93",
                    fontStyle: "italic",
                  }}
                >
                  Thinking about what you just did...
                </div>
              ) : (
                <div style={S.feedbackText}>{aiFeedback}</div>
              )}
            </div>

            {totalResets >= 5 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  background: "rgba(35,32,29,0.04)",
                  border: "1px solid rgba(35,32,29,0.08)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#23201D",
                    flexShrink: 0,
                    boxShadow: "0 0 0 3px rgba(35,32,29,0.1)",
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    color: "#6F6861",
                    fontStyle: "italic",
                    lineHeight: 1.4,
                  }}
                >
                  {totalResets} resets in. Reset is starting to know you.
                  {totalResets >= 20 && " The patterns are getting clearer."}
                  {totalResets >= 50 &&
                    " This data is yours — no one else has it."}
                </div>
              </div>
            )}

            {latestEntry.status === "done" &&
              followUpSeconds !== null &&
              !showFollowUp &&
              !followUpAnswer && (
                <div
                  style={{
                    background: "#0D0B09",
                    border: "1px solid #2A2520",
                    borderRadius: 18,
                    padding: "14px 18px",
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                        color: "rgba(245,241,234,0.3)",
                        marginBottom: 4,
                      }}
                    >
                      Follow-up in
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(245,241,234,0.6)",
                      }}
                    >
                      Did you actually do it?
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      color: "rgba(245,241,234,0.85)",
                      fontFamily:
                        'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                      letterSpacing: "-0.03em",
                      minWidth: 52,
                      textAlign: "right" as const,
                    }}
                  >
                    {Math.floor(followUpSeconds / 60)}:
                    {String(followUpSeconds % 60).padStart(2, "0")}
                  </div>
                </div>
              )}

            {latestEntry.status === "done" && streak > 0 && (
              <div
                style={{
                  ...S.resultBox,
                  background: streak >= 7 ? "#FFF8E1" : "#F7F3EC",
                  border:
                    streak >= 7
                      ? "1px solid #F0C040"
                      : "1px solid #DDD5CA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={S.label}>Current streak</div>
                  <div
                    style={{
                      ...S.unfinishedMove,
                      marginBottom: 0,
                      color: streak >= 7 ? "#7A5200" : "#161413",
                    }}
                  >
                    {streak} day{streak !== 1 ? "s" : ""}
                  </div>
                </div>
                {streak >= 7 && (
                  <div style={{ fontSize: 28 }}>★</div>
                )}
              </div>
            )}
            <div style={S.shareBox}>
              <div style={S.shareTitle}>Accountability</div>
              <div style={S.shareText}>
                Send it to one person. Make it harder to disappear.
              </div>
              <button style={S.cta} onClick={shareMove}>
                {shareCopied ? "Copied" : "Share my move"}
              </button>
            </div>
            <button style={S.ctaMuted} onClick={resetFlow}>
              Back to start
            </button>
          </div>
        )}

        {/* ── WEEKLY REFLECTION SCREEN ── */}
        {screen === "reflect" && journey && (
          <div style={S.card}>
            <div style={S.stepPill}>Week {journeyWeek} of 13</div>
            <div style={S.title}>Two minutes. Look back, then aim.</div>
            {!reflectAI ? (
              <>
                <div style={{ ...S.label, marginBottom: 6 }}>
                  Which move actually mattered this week?
                </div>
                <input
                  style={S.input}
                  value={reflectAnswers[0]}
                  maxLength={140}
                  onChange={(e) =>
                    setReflectAnswers([
                      e.target.value,
                      reflectAnswers[1],
                      reflectAnswers[2],
                    ])
                  }
                />
                <div style={{ ...S.label, margin: "10px 0 6px" }}>
                  What did you avoid all 7 days?
                </div>
                <input
                  style={S.input}
                  value={reflectAnswers[1]}
                  maxLength={140}
                  onChange={(e) =>
                    setReflectAnswers([
                      reflectAnswers[0],
                      e.target.value,
                      reflectAnswers[2],
                    ])
                  }
                />
                <div style={{ ...S.label, margin: "10px 0 6px" }}>
                  One thing to drop next week
                </div>
                <input
                  style={S.input}
                  value={reflectAnswers[2]}
                  maxLength={140}
                  onChange={(e) =>
                    setReflectAnswers([
                      reflectAnswers[0],
                      reflectAnswers[1],
                      e.target.value,
                    ])
                  }
                />
                <button
                  style={{
                    ...S.cta,
                    marginTop: 14,
                    ...(reflectAnswers.every((a) => a.trim()) && !reflectLoading
                      ? {}
                      : S.ctaDisabled),
                  }}
                  disabled={
                    !reflectAnswers.every((a) => a.trim()) || reflectLoading
                  }
                  onClick={submitReflection}
                >
                  {reflectLoading ? "Reading your week..." : "Reflect"}
                </button>
                <button style={S.ctaMuted} onClick={() => setScreen("start")}>
                  Not now
                </button>
              </>
            ) : (
              <>
                <div style={S.aiFeedbackBox}>
                  <div style={S.aiBadge}>The diary answers back</div>
                  <div style={S.feedbackText}>{reflectAI}</div>
                </div>
                <button style={S.cta} onClick={() => setScreen("start")}>
                  Aim at week {journeyWeek + 1}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── INSIGHTS SCREEN ── */}
        {screen === "insights" && (
          <div style={S.card}>
            <div style={S.stepPill}>Insights</div>
            <div style={S.title}>What your resets reveal.</div>
            <div style={{ ...S.sub, marginBottom: 18 }}>
              Patterns from your last {totalResets} resets.
            </div>
            <div style={S.summaryGrid}>
              <div style={S.summaryBox}>
                <div style={S.summaryNum}>{totalResets}</div>
                <div style={S.summaryLabel}>Total resets</div>
              </div>
              <div style={S.summaryBox}>
                <div style={S.summaryNum}>{patterns.completionRate}%</div>
                <div style={S.summaryLabel}>Moves done</div>
              </div>
              <div style={S.summaryBoxGold}>
                <div style={S.summaryNumGold}>{streak}</div>
                <div style={S.summaryLabelGold}>Day streak</div>
              </div>
              <div style={S.summaryBox}>
                <div style={S.summaryNum}>
                  {patterns.avgPresence > 0 ? patterns.avgPresence : "—"}
                </div>
                <div style={S.summaryLabel}>Avg presence</div>
              </div>
            </div>
            {patterns.topAvoiding && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>◎</div>
                <div>
                  <div style={S.insightTitle}>Your most avoided thing</div>
                  <div style={S.insightBody}>
                    "{patterns.topAvoiding}" keeps coming back. Whatever it is,
                    it's not going anywhere until you go at it.
                  </div>
                </div>
              </div>
            )}
            {patterns.mostProductiveDays.length > 0 && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>↑</div>
                <div>
                  <div style={S.insightTitle}>Your strongest days</div>
                  <div style={S.insightBody}>
                    You complete the most moves on{" "}
                    {patterns.mostProductiveDays.join(" and ")}. Put the hard
                    ones there.
                  </div>
                </div>
              </div>
            )}
            <div style={S.insightRow}>
              <div style={S.insightIcon}>◑</div>
              <div>
                <div style={S.insightTitle}>Done vs not yet</div>
                <div style={S.insightBody}>
                  {doneCount} done, {notYetCount} not yet. Every "not yet" is
                  data — usually the move was too big.
                </div>
              </div>
            </div>
            <button style={S.ctaMuted} onClick={() => setScreen("start")}>
              ← Back
            </button>
          </div>
        )}

        {/* ── HISTORY SCREEN ── */}
        {screen === "history" && (
          <div style={S.card}>
            <div style={S.stepPill}>History</div>
            <div style={S.title}>Your record.</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>
              Every reset, every move, every truth.
            </div>
            {entries.length === 0 ? (
              <div style={S.emptyState}>
                Nothing yet. Your first reset starts the record.
              </div>
            ) : (
              <div style={S.historyList}>
                {entries.map((e) => (
                  <div key={e.id} style={S.historyCard}>
                    <div style={S.historyTop}>
                      <div style={S.historyDate}>{formatDate(e.createdAt)}</div>
                      <div style={S.statusBadge(e.status)}>
                        {e.status === "done" ? "Done" : "Not yet"}
                      </div>
                    </div>
                    <div style={S.historyLine}>
                      <span style={S.historyLineLabel}>Mind: </span>
                      {e.mind}
                    </div>
                    <div style={S.historyLine}>
                      <span style={S.historyLineLabel}>Avoiding: </span>
                      {e.avoiding}
                    </div>
                    <div style={S.historyLine}>
                      <span style={S.historyLineLabel}>Move: </span>
                      {e.move}
                    </div>
                    {e.feedback && e.feedback !== "..." && (
                      <div
                        style={{
                          ...S.historyLine,
                          fontStyle: "italic",
                          color: "#6F6861",
                          marginTop: 6,
                        }}
                      >
                        {e.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              style={{ ...S.ctaMuted, marginTop: 16 }}
              onClick={() => setScreen("start")}
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── SEAL MODAL ── */}
        {openSeal !== null && journey && (
          <div style={S.modalBackdrop} onClick={() => setOpenSeal(null)}>
            <div style={S.modalCardGold} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalImageGold}>✉</div>
              <div style={S.modalBody}>
                <div style={S.modalTitleGold}>Day {openSeal}. Unsealed.</div>
                <div style={S.modalTextGold}>
                  You moved {doneInJourney} times. This is from you, day 1:
                </div>
                <div
                  style={{
                    background: "rgba(255,253,249,0.6)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    fontFamily:
                      'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                    fontStyle: "italic",
                    fontSize: 16,
                    color: "#5C4400",
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}
                >
                  "{journey.seal}"
                </div>
                <button style={S.ctaGold} onClick={() => unseal(openSeal)}>
                  {openSeal === 90 ? "Close the cycle" : "Keep going"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FOLLOW-UP MODAL — 5 minutes after "done" ── */}
        {showFollowUp && !followUpAnswer && (
          <div style={S.modalBackdrop}>
            <div style={S.modalCard}>
              <div style={S.modalBody}>
                <div style={S.modalTitle}>5 minutes later.</div>
                <div style={S.modalText}>
                  You said you did it. Still true — or did it slip the second
                  you closed the app?
                </div>
                <div style={S.statusRow}>
                  <button
                    style={{
                      ...S.statusPrimary,
                      background: "#23201D",
                      color: "#F5F1EA",
                    }}
                    onClick={() => {
                      setFollowUpAnswer("confirmed");
                      setShowFollowUp(false);
                    }}
                  >
                    Still done
                  </button>
                  <button
                    style={{
                      ...S.statusSecondary,
                      border: "1px solid #DDD5CA",
                      color: "#6F6861",
                    }}
                    onClick={() => {
                      setFollowUpAnswer("slipped");
                      setShowFollowUp(false);
                    }}
                  >
                    It slipped
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PATTERN FLASH MODAL ── */}
        {showPatternFlash && patternFlash && (
          <div
            style={S.modalBackdrop}
            onClick={() => setShowPatternFlash(false)}
          >
            <div
              style={{ ...S.modalCard, background: "#0E0C0A", border: "1px solid #2A2520" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={S.modalBody}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(200,150,70,0.8)",
                    marginBottom: 10,
                  }}
                >
                  Pattern spotted
                </div>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 500,
                    fontFamily:
                      'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
                    color: "rgba(245,241,234,0.9)",
                    lineHeight: 1.4,
                    letterSpacing: "-0.02em",
                    marginBottom: 18,
                  }}
                >
                  {patternFlash}
                </div>
                <button
                  style={{
                    ...S.ctaMuted,
                    border: "1px solid rgba(245,241,234,0.2)",
                    color: "rgba(245,241,234,0.6)",
                    marginBottom: 0,
                  }}
                  onClick={() => setShowPatternFlash(false)}
                >
                  Noted
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT POPUP ── */}
        {showResultPopup && latestEntry && (
          <div
            style={S.modalBackdrop}
            onClick={() => setShowResultPopup(false)}
          >
            <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalImage} />
              <div style={S.modalBody}>
                <div style={S.modalTitle}>
                  {latestEntry.status === "done"
                    ? "You showed up."
                    : "You were honest."}
                </div>
                <div style={S.modalText}>
                  {latestEntry.status === "done"
                    ? "One move. That's how every 90 days gets built."
                    : "Honesty counts. Tomorrow, cut the move in half and take the smaller door."}
                </div>
                <div style={S.modalDate}>{latestResetTime}</div>
                <button
                  style={S.cta}
                  onClick={() => setShowResultPopup(false)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MILESTONE MODAL ── */}
        {showMilestone && (
          <div style={S.modalBackdrop} onClick={() => setShowMilestone(false)}>
            <div style={S.modalCardGold} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalImageGold}>★</div>
              <div style={S.modalBody}>
                <div style={S.modalTitleGold}>{streak} days.</div>
                <div style={S.modalTextGold}>{getMilestoneLabel(streak)}</div>
                <button
                  style={S.ctaGold}
                  onClick={() => setShowMilestone(false)}
                >
                  Keep building
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={S.footer}>Stop thinking. Start moving.</div>
      </div>
    </div>
  );
}

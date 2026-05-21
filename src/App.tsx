import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

type Screen =
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

// ── SEEDED PULSE DATA ──────────────────────────────────────────────────────
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

function makeProfileId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
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

async function getAIFeedback(
  status: EntryStatus, mind: string, avoiding: string, move: string,
  name: string, pastPatterns: string, presenceScore: number
): Promise<string> {
  const prompt = `You are the voice inside Reset — a reconnection app for high performers in the Gulf region who have lost themselves in their work.

User: ${name}
Presence score today: ${presenceScore}/5 (${PRESENCE_LABELS[presenceScore]?.en})
Status: ${status === "done" ? "They DID the move" : "They did NOT do the move yet"}
What was on their mind: "${mind}"
What they were avoiding: "${avoiding}"
Their committed move: "${move}"
${pastPatterns ? `Their recent patterns: ${pastPatterns}` : ""}

Write 2-3 sentences. Be specific to EXACTLY what they wrote.
Reference their presence score naturally — someone at 1-2 needs gentleness, someone at 4-5 needs a push.
Tone: like a wise, warm friend who has also been in high-pressure roles and knows what it costs. Never corporate. Never generic.
Never start with "I" or the user's name. No emojis. No lists.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
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
  if (status === "done") return "You moved. That's the whole game — not perfection, just momentum. Do it again tomorrow.";
  return "Not yet is just data. The move was probably too big. Cut it in half and try the smaller door.";
}

function analyzePatterns(entries: Entry[]): {
  topAvoiding: string | null;
  completionRate: number;
  mostProductiveDays: string[];
  avgPresence: number;
} {
  if (entries.length < 3) return { topAvoiding: null, completionRate: 0, mostProductiveDays: [], avgPresence: 0 };

  const avoidingMap: Record<string, number> = {};
  entries.forEach((e) => {
    const key = e.avoiding.toLowerCase().trim();
    avoidingMap[key] = (avoidingMap[key] || 0) + 1;
  });
  const topAvoiding = Object.entries(avoidingMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const done = entries.filter((e) => e.status === "done").length;
  const completionRate = Math.round((done / entries.length) * 100);

  const dayMap: Record<string, { done: number; total: number }> = {};
  entries.forEach((e) => {
    const day = new Date(e.createdAt).toLocaleDateString(undefined, { weekday: "long" });
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
    ? Math.round((presenceEntries.reduce((sum, e) => sum + (e.presenceScore || 0), 0) / presenceEntries.length) * 10) / 10
    : 0;

  return { topAvoiding, completionRate, mostProductiveDays, avgPresence };
}

function buildPastPatternsSummary(entries: Entry[]): string {
  if (entries.length < 3) return "";
  const recent = entries.slice(0, 7);
  const avoidingList = Array.from(new Set(recent.map((e) => e.avoiding))).slice(0, 3).join(", ");
  const doneCount = recent.filter((e) => e.status === "done").length;
  const avgPresence = recent.filter(e => e.presenceScore).reduce((s, e) => s + (e.presenceScore || 0), 0) / (recent.filter(e => e.presenceScore).length || 1);
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

// ── PULSE TEASER COMPONENT ─────────────────────────────────────────────────
function PulseTeaser({ onExpand }: { onExpand: () => void }) {
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: "#161413",
      borderRadius: 24,
      padding: "20px 22px",
      marginBottom: 14,
      border: "1px solid #2A2520",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle warm glow top-right */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,120,50,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
            textTransform: "uppercase", color: "rgba(245,241,234,0.35)", marginBottom: 4,
          }}>
            Community pulse
          </div>
          <div style={{
            fontSize: 18, fontWeight: 500, color: "rgba(245,241,234,0.88)",
            fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
            letterSpacing: "-0.02em", lineHeight: 1.2,
          }}>
            What others are doing right now
          </div>
        </div>
        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#4CAF50",
            boxShadow: "0 0 6px rgba(76,175,80,0.6)",
            animation: "pulseLive 2s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 11, color: "rgba(245,241,234,0.4)", letterSpacing: "0.04em" }}>1,240 today</span>
        </div>
      </div>

      {/* Stat row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20,
      }}>
        {[
          { num: "11", label: "avg streak" },
          { num: "78%", label: "completed" },
          { num: "9 AM", label: "peak hour" },
        ].map(({ num, label }) => (
          <div key={label} style={{
            background: "rgba(245,241,234,0.04)",
            border: "1px solid rgba(245,241,234,0.07)",
            borderRadius: 14, padding: "10px 12px",
          }}>
            <div style={{
              fontSize: 20, fontWeight: 500, color: "rgba(245,241,234,0.85)",
              letterSpacing: "-0.03em", lineHeight: 1,
              fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
            }}>{num}</div>
            <div style={{ fontSize: 10, color: "rgba(245,241,234,0.3)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Avoidance bars */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 12,
        }}>
          Most avoided this week
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "rgba(245,241,234,0.55)" }}>{item.label}</span>
                <span style={{ fontSize: 12, color: "rgba(245,241,234,0.3)", fontVariantNumeric: "tabular-nums" }}>{item.pct}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(245,241,234,0.07)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: i === 0
                    ? "rgba(180,120,50,0.7)"
                    : i === 1
                    ? "rgba(245,241,234,0.25)"
                    : "rgba(245,241,234,0.13)",
                  width: barsVisible ? `${item.pct}%` : "0%",
                  transition: `width 0.9s ease ${i * 0.12}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 16 }} />

      {/* One insight teaser */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "rgba(180,120,50,0.12)",
          border: "1px solid rgba(180,120,50,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontSize: 13, color: "rgba(200,150,70,0.8)",
        }}>↑</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(245,241,234,0.75)", marginBottom: 3 }}>
            Monday resets build streaks
          </div>
          <div style={{ fontSize: 12, color: "rgba(245,241,234,0.35)", lineHeight: 1.55 }}>
            People who reset on Monday are 2× more likely to still be going by Friday.
          </div>
        </div>
      </div>

      {/* Expand CTA */}
      <button
        onClick={onExpand}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 14,
          border: "1px solid rgba(245,241,234,0.1)",
          background: "rgba(245,241,234,0.04)",
          color: "rgba(245,241,234,0.5)", fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,241,234,0.08)";
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(245,241,234,0.75)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,241,234,0.04)";
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(245,241,234,0.5)";
        }}
      >
        See full community map
        <span style={{ fontSize: 11, opacity: 0.6 }}>→</span>
      </button>
    </div>
  );
}

// ── PULSE FULL SCREEN ──────────────────────────────────────────────────────
function PulseScreen({ onBack }: { onBack: () => void }) {
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: "#161413", borderRadius: 28, padding: "24px 22px",
      border: "1px solid #2A2520", marginBottom: 14,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,120,50,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 6 }}>
            Community pulse
          </div>
          <div style={{
            fontSize: 26, fontWeight: 500, color: "rgba(245,241,234,0.9)",
            fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
            letterSpacing: "-0.03em", lineHeight: 1.15,
          }}>
            How the world resets.
          </div>
          <div style={{ fontSize: 13, color: "rgba(245,241,234,0.3)", fontStyle: "italic", marginTop: 4 }}>
            كيف يعيد الناس ضبط أنفسهم
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px rgba(76,175,80,0.6)", animation: "pulseLive 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, color: "rgba(245,241,234,0.35)" }}>Live</span>
        </div>
      </div>

      {/* Big stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { num: "1,240", label: "Resets today", sub: "across all users" },
          { num: "78%", label: "Completed today", sub: "marked as done" },
          { num: "11 days", label: "Average streak", sub: "among active users" },
          { num: "9 AM", label: "Peak reset time", sub: "most users arrive early" },
        ].map(({ num, label, sub }) => (
          <div key={label} style={{
            background: "rgba(245,241,234,0.03)",
            border: "1px solid rgba(245,241,234,0.07)",
            borderRadius: 16, padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 24, fontWeight: 500, color: "rgba(245,241,234,0.88)",
              fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif',
              letterSpacing: "-0.04em", lineHeight: 1,
            }}>{num}</div>
            <div style={{ fontSize: 12, color: "rgba(245,241,234,0.6)", marginTop: 5, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 11, color: "rgba(245,241,234,0.25)", marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Avoidance bars */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 14 }}>
          Most avoided this week
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "rgba(245,241,234,0.6)" }}>{item.label}</span>
                <span style={{ fontSize: 13, color: i === 0 ? "rgba(200,150,70,0.8)" : "rgba(245,241,234,0.3)", fontVariantNumeric: "tabular-nums", fontWeight: i === 0 ? 700 : 400 }}>{item.pct}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(245,241,234,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: i === 0 ? "linear-gradient(90deg,rgba(180,120,50,0.8),rgba(220,160,60,0.6))"
                    : i === 1 ? "rgba(245,241,234,0.22)"
                    : i === 2 ? "rgba(245,241,234,0.14)"
                    : "rgba(245,241,234,0.08)",
                  width: barsVisible ? `${item.pct}%` : "0%",
                  transition: `width 1s ease ${i * 0.15}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 20 }} />

      {/* Insights */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 14 }}>
          Behavioural patterns
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PULSE_INSIGHTS.map((ins) => (
            <div key={ins.title} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: "rgba(180,120,50,0.1)",
                border: "1px solid rgba(180,120,50,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 14, color: "rgba(200,150,70,0.75)",
              }}>{ins.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(245,241,234,0.78)", marginBottom: 3 }}>{ins.title}</div>
                <div style={{ fontSize: 12, color: "rgba(245,241,234,0.38)", lineHeight: 1.6 }}>{ins.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Presence breakdown */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 12 }}>
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
              5: "rgba(26,58,92,0.8)", 4: "rgba(46,94,46,0.7)",
              3: "rgba(122,98,0,0.7)", 2: "rgba(184,92,0,0.65)", 1: "rgba(139,30,30,0.65)",
            };
            return (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 90, fontSize: 11, color: "rgba(245,241,234,0.4)", textAlign: "right" }}>{item.label}</div>
                <div style={{ flex: 1, height: 6, background: "rgba(245,241,234,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: colors[item.score],
                    width: barsVisible ? `${item.pct}%` : "0%",
                    transition: `width 1s ease ${item.score * 0.1}s`,
                  }} />
                </div>
                <div style={{ width: 28, fontSize: 11, color: "rgba(245,241,234,0.3)", fontVariantNumeric: "tabular-nums" }}>{item.pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 16 }} />

      <div style={{ fontSize: 11, color: "rgba(245,241,234,0.2)", lineHeight: 1.6, marginBottom: 18, fontStyle: "italic", textAlign: "center" }}>
        Data is anonymous and aggregated. No individual entries are visible to others.
      </div>

      <button
        onClick={onBack}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 14,
          border: "1px solid rgba(245,241,234,0.12)",
          background: "transparent",
          color: "rgba(245,241,234,0.45)", fontSize: 14,
          cursor: "pointer", fontFamily: "inherit",
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

  const mindRef = useRef<HTMLInputElement>(null);
  const avoidRef = useRef<HTMLInputElement>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screen !== "arrival") return;
    const timer = window.setInterval(() => {
      setBreathePhase(p => p === "in" ? "out" : "in");
      setBreatheCount(c => {
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
      const reminderEnabled = localStorage.getItem("reset_reminder_enabled") === "true";
      setNotifEnabled(reminderEnabled);
      if ("Notification" in window) setNotifPermission(Notification.permission);
      if (!savedProfileId) { setScreen("profile"); setLoading(false); return; }
      const { data, error } = await supabase.from("profiles").select("*").eq("id", savedProfileId).single();
      if (error || !data) { setScreen("profile"); setLoading(false); return; }
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
      (e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime()
    );
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const hadYesterday = entries.some(
      (e) => e.status === "done" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime()
    );
    if (hadYesterday && !hasResetToday) setStreakAtRisk(true);
    const yesterdayNotYet = entries.find(
      (e) => e.status === "not_yet" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime()
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
      .from("entries").select("*").eq("profile_id", profileId)
      .order("created_at", { ascending: false }).limit(50);
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
        setBreathePhase((p) => (next % 2 === 0 ? (p === "in" ? "out" : "in") : p));
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown]);

  const latestEntry = useMemo(
    () => (latestId ? entries.find((e) => e.id === latestId) ?? null : null),
    [entries, latestId]
  );

  const doneCount = useMemo(() => entries.filter((e) => e.status === "done").length, [entries]);
  const notYetCount = useMemo(() => entries.filter((e) => e.status === "not_yet").length, [entries]);
  const totalResets = entries.length;
  const lastNotYet = useMemo(() => entries.find((e) => e.status === "not_yet"), [entries]);

  const latestResetTime = latestEntry
    ? new Date(latestEntry.createdAt).toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      }) : "";

  const hasResetToday = useMemo(
    () => entries.some((e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime()),
    [entries]
  );

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 100; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const has = entries.some(
        (e) => e.status === "done" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(d).getTime()
      );
      if (has) s++; else break;
    }
    return s;
  }, [entries]);

  const trackerDays = useMemo(() => {
    const days: { label: string; active: boolean; isToday: boolean; presence?: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const dayEntries = entries.filter(
        (e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(day).getTime()
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
    if (!profileName.trim()) { setProfileError("Name is required."); return; }
    const id = makeProfileId(profileName);
    const { data, error } = await supabase.from("profiles").upsert({ id, name: profileName.trim() }, { onConflict: "id" }).select().single();
    if (error) { setProfileError(error.message); return; }
    localStorage.setItem("reset_profile_id", id);
    setProfile(data as Profile);
    setScreen("arrival");
  }

  function changeName() {
    localStorage.removeItem("reset_profile_id");
    cancelLocalReminder();
    setProfile(null); setEntries([]); setProfileName(""); setNotifEnabled(false);
    setScreen("profile");
  }

  function resetFlow() {
    setMind(""); setAvoiding(""); setMove("");
    setCountdown(COMMIT_SECONDS); setLatestId(null);
    setShareCopied(false); setShowResultPopup(false);
    setShowMilestone(false); setAiFeedback("");
    setScreen(profile ? "start" : "profile");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(COMMIT_SECONDS); setBreathePhase("in");
    setScreen("commit");
  }

  async function saveResult(status: EntryStatus) {
    if (!profile) return;
    setAiFeedbackLoading(true);
    const pastPatterns = buildPastPatternsSummary(entries);
    const { data, error } = await supabase.from("entries").insert({
      profile_id: profile.id,
      mind: mind.trim(), avoiding: avoiding.trim(), move: move.trim(),
      status, feedback: "...", presence_score: presenceScore || null,
    }).select().single();
    if (error) { alert("The entry did not save. Check Supabase table or policies."); setAiFeedbackLoading(false); return; }
    const newEntry = mapEntry(data);
    setEntries((prev) => [newEntry, ...prev].slice(0, 50));
    setLatestId(newEntry.id);
    setScreen("result");
    const newStreak = status === "done" ? streak + 1 : streak;
    if (status === "done" && MILESTONE_DAYS.includes(newStreak)) { setShowMilestone(true); } else { setShowResultPopup(true); }
    const feedback = await getAIFeedback(status, mind, avoiding, move, profile.name, pastPatterns, presenceScore);
    setAiFeedback(feedback);
    setAiFeedbackLoading(false);
    await supabase.from("entries").update({ feedback }).eq("id", newEntry.id);
    setEntries((prev) => prev.map((e) => (e.id === newEntry.id ? { ...e, feedback } : e)));
  }

  async function toggleNotifications() {
    if (notifEnabled) { cancelLocalReminder(); setNotifEnabled(false); return; }
    const granted = await requestNotificationPermission();
    if (granted) { setNotifPermission("granted"); scheduleLocalReminder(profile?.name ?? ""); setNotifEnabled(true); }
    else { setNotifPermission("denied"); }
  }

  function resumeCheckin() {
    if (!checkinEntry) return;
    setMind(checkinEntry.mind); setAvoiding(checkinEntry.avoiding); setMove(checkinEntry.move);
    setCountdown(COMMIT_SECONDS); setBreathePhase("in"); setScreen("commit");
  }

  function resumeLastNotYet() {
    if (!lastNotYet) return;
    setMind(lastNotYet.mind); setAvoiding(lastNotYet.avoiding); setMove(lastNotYet.move);
    setScreen("move");
  }

  async function shareMove() {
    const text = `I said I would do this: ${move}. Check on me.`;
    try {
      if (navigator.share) { await navigator.share({ title: "Reset", text }); return; }
      await navigator.clipboard.writeText(text);
      setShareCopied(true); window.setTimeout(() => setShareCopied(false), 1800);
    } catch {}
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0D0B09" }}>
        <div style={{ fontSize: 13, color: "#6F6861", letterSpacing: "0.15em" }}>...</div>
      </div>
    );
  }

  const S: Record<string, CSSProperties | any> = {
    page: { minHeight: "100vh", background: "#F5F1EA", padding: "0 0 40px" },
    wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px" },
    topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 14 },
    badge: { fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#23201D" },
    profileBtn: { fontSize: 12, color: "#6F6861", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" },
    card: { background: "#FFFDF9", border: "1px solid #DDD5CA", borderRadius: 28, padding: 24, marginBottom: 14, boxShadow: "0 18px 50px rgba(35,32,29,0.06)" },
    progressWrap: { height: 3, background: "#E8E2D9", borderRadius: 999, marginBottom: 20, overflow: "hidden" },
    stepPill: { display: "inline-block", background: "#F7F1E6", border: "1px solid #DDD5CA", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#6F6861", marginBottom: 14 },
    stepPillDark: { background: "#23201D", color: "#F5F1EA", border: "none" },
    title: { fontSize: 28, lineHeight: 1.15, fontWeight: 500, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', marginBottom: 6, letterSpacing: "-0.03em", color: "#161413" },
    sub: { fontSize: 14, color: "#6F6861", lineHeight: 1.5, marginBottom: 14 },
    subDark: { color: "#A79E93" },
    label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#6F6861" },
    focusHint: { fontSize: 12, color: "#6F6861", marginBottom: 16, fontStyle: "italic" },
    chips: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 14 },
    chip: { padding: "7px 14px", borderRadius: 999, border: "1px solid #DDD5CA", background: "#F7F1E6", fontSize: 13, cursor: "pointer", color: "#4A4540", fontFamily: "inherit" },
    chipActive: { background: "#23201D", color: "#F5F1EA", border: "1px solid #23201D" },
    input: { width: "100%", padding: "13px 14px", borderRadius: 16, border: "1px solid #DDD5CA", background: "#F7F1E6", fontSize: 15, color: "#161413", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 8 },
    helperRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#736C64", marginBottom: 16 },
    helper: { fontSize: 12, color: "#736C64" },
    cta: { width: "100%", padding: "15px 18px", borderRadius: 18, border: "none", background: "#23201D", color: "#F5F1EA", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 },
    ctaDisabled: { opacity: 0.38, cursor: "not-allowed" },
    ctaMuted: { width: "100%", padding: "13px 18px", borderRadius: 18, border: "1px solid #DDD5CA", background: "transparent", color: "#6F6861", fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 },
    ctaGold: { width: "100%", padding: "15px 18px", borderRadius: 18, border: "none", background: "#E8A000", color: "#FFF8E1", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" },
    trackerCard: { background: "#FFFDF9", border: "1px solid #DDD5CA", borderRadius: 22, padding: 16, marginBottom: 14, boxShadow: "0 14px 40px rgba(35,32,29,0.05)" },
    trackerCardMilestone: { background: "linear-gradient(135deg,#FFF8E1 0%,#FFF3CC 50%,#FFFDF9 100%)", border: "1.5px solid #F0C040", borderRadius: 22, padding: 16, marginBottom: 14, animation: "goldPulse 2s ease-in-out infinite" },
    trackerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    streakPill: { display: "inline-flex", alignItems: "center", gap: 5, background: "#23201D", color: "#F5F1EA", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
    streakPillMilestone: { display: "inline-flex", alignItems: "center", gap: 5, background: "#E8A000", color: "#FFF8E1", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
    streakAtRiskPill: { display: "inline-block", background: "#8B1E1E", color: "#FFFDF9", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
    trackerRow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, textAlign: "center" as const },
    trackerDay: { fontSize: 10, color: "#6F6861", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 5 },
    trackerText: { fontSize: 12, color: "#6F6861" },
    dot: { width: 10, height: 10, borderRadius: "50%", background: "#E8E2D9" },
    dotActive: { background: "#23201D" },
    dotToday: { boxShadow: "0 0 0 2px #F5F1EA, 0 0 0 3.5px #23201D" },
    milestoneText: { fontSize: 13, color: "#B07A00", fontStyle: "italic", marginTop: 10, lineHeight: 1.5 },
    riskBanner: { background: "#1E0A0A", border: "1px solid #5C1F1F", borderRadius: 16, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
    riskText: { fontSize: 13, color: "#F5C0C0", lineHeight: 1.45, flex: 1 },
    riskButton: { padding: "8px 14px", borderRadius: 999, border: "none", background: "#8B1E1E", color: "#FFFDF9", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const },
    notifRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#FFFDF9", border: "1px solid #DDD5CA", borderRadius: 16, padding: "12px 16px", marginBottom: 10 },
    notifLabel: { fontSize: 13, color: "#23201D", fontWeight: 600 },
    notifSub: { fontSize: 11, color: "#6F6861", marginTop: 2 },
    toggleTrack: (on: boolean): CSSProperties => ({ width: 44, height: 26, borderRadius: 999, background: on ? "#23201D" : "#DDD5CA", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }),
    toggleThumb: (on: boolean): CSSProperties => ({ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#FFFDF9", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }),
    checkinCard: { background: "#FFFDF9", border: "1px solid #DDD5CA", borderRadius: 28, padding: 24, boxShadow: "0 18px 50px rgba(35,32,29,0.06)" },
    checkinBadge: { display: "inline-block", background: "#F7F1E6", border: "1px solid #DDD5CA", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#6F6861", marginBottom: 14 },
    checkinMove: { fontSize: 24, lineHeight: 1.2, fontWeight: 500, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', margin: "10px 0 6px", letterSpacing: "-0.03em" },
    heroCard: { position: "relative", minHeight: 520, borderRadius: 28, overflow: "hidden", marginBottom: 14, backgroundImage: "url('/garden.png')", backgroundSize: "cover", backgroundPosition: "center" },
    heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(245,241,234,0.08) 0%,rgba(35,32,29,0.72) 100%)", padding: "32px 28px", display: "flex", flexDirection: "column" as const, justifyContent: "space-between" },
    heroTitle: { fontSize: 38, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#F5F1EA", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', whiteSpace: "pre-line" as const, marginBottom: 10 },
    heroSub: { fontSize: 15, color: "rgba(245,241,234,0.72)", lineHeight: 1.5, maxWidth: 260 },
    heroBottom: { maxWidth: 320 },
    startButton: { width: "100%", padding: "18px 20px", borderRadius: 20, border: "none", background: "#F5F1EA", color: "#23201D", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 },
    heroFoot: { fontSize: 12, color: "rgba(245,241,234,0.5)", textAlign: "center" as const, marginTop: 8 },
    unfinishedCard: { background: "#FFFDF9", border: "1px solid #DDD5CA", borderRadius: 22, padding: 18, marginBottom: 12 },
    unfinishedMove: { fontSize: 20, fontWeight: 500, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', marginBottom: 4, letterSpacing: "-0.02em" },
    commitCard: { background: "#161413", border: "1px solid #2A2520" },
    moveBox: { background: "rgba(245,241,234,0.06)", borderRadius: 16, padding: "16px 18px", marginBottom: 24 },
    moveBig: { fontSize: 26, fontWeight: 500, lineHeight: 1.2, color: "#F5F1EA", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.03em" },
    breatheRing: (phase: string): CSSProperties => ({ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${phase === "in" ? "#F5F1EA" : "rgba(245,241,234,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", transform: phase === "in" ? "scale(1.08)" : "scale(0.95)", transition: "all 1s ease" }),
    breatheNum: { fontSize: 28, fontWeight: 800, color: "#F5F1EA", letterSpacing: "-0.04em" },
    breatheLabel: { fontSize: 12, color: "rgba(245,241,234,0.5)", textAlign: "center" as const, marginBottom: 20, letterSpacing: "0.08em" },
    statusRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    statusPrimary: { padding: "14px 10px", borderRadius: 16, border: "none", background: "#F5F1EA", color: "#161413", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" },
    statusSecondary: { padding: "14px 10px", borderRadius: 16, border: "1px solid rgba(245,241,234,0.2)", background: "transparent", color: "rgba(245,241,234,0.6)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" },
    aiFeedbackBox: { background: "#F0EDE6", border: "1px solid #C8BFB4", borderRadius: 16, padding: "14px 16px", marginBottom: 14 },
    aiBadge: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#8A7F74", marginBottom: 6 },
    feedbackText: { fontSize: 14, color: "#2B2723", lineHeight: 1.6 },
    resultBox: { background: "#F7F3EC", border: "1px solid #DDD5CA", borderRadius: 16, padding: "12px 14px", marginBottom: 14 },
    shareBox: { background: "#F7F3EC", border: "1px solid #DDD5CA", borderRadius: 16, padding: "14px 16px", marginBottom: 14 },
    shareTitle: { fontSize: 13, fontWeight: 700, marginBottom: 5 },
    shareText: { fontSize: 13, color: "#6F6861", lineHeight: 1.5, marginBottom: 11 },
    historyList: { display: "grid", gap: 10 },
    historyCard: { padding: 14, borderRadius: 16, border: "1px solid #E8E2D9", background: "#FDFAF6" },
    historyTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, flexWrap: "wrap" as const },
    historyDate: { fontSize: 12, color: "#6F6861" },
    historyLine: { fontSize: 13, lineHeight: 1.5, color: "#161413", marginBottom: 5 },
    historyLineLabel: { fontWeight: 700, color: "#6F6861" },
    emptyState: { textAlign: "center" as const, padding: "32px 16px", color: "#6F6861", fontSize: 14 },
    statusBadge: (s: EntryStatus): CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s === "done" ? "#E8F5E9" : "#FFF3E0", color: s === "done" ? "#2E7D32" : "#E65100" }),
    insightRow: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 },
    insightIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
    insightTitle: { fontSize: 13, fontWeight: 700, color: "#23201D", marginBottom: 3 },
    insightBody: { fontSize: 13, color: "#6F6861", lineHeight: 1.5 },
    summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
    summaryBox: { background: "#F7F3EC", border: "1px solid #E8E2D9", borderRadius: 16, padding: 12 },
    summaryBoxGold: { background: "rgba(232,160,0,0.1)", border: "1px solid rgba(232,160,0,0.3)", borderRadius: 16, padding: 12 },
    summaryNum: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em" },
    summaryNumGold: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em", color: "#7A5200" },
    summaryLabel: { fontSize: 11, color: "#6F6861", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginTop: 3 },
    summaryLabelGold: { fontSize: 11, color: "#9A7000", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginTop: 3 },
    modalBackdrop: { position: "fixed" as const, inset: 0, background: "rgba(18,17,15,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 16px 32px", zIndex: 100 },
    modalCard: { width: "100%", maxWidth: 420, background: "#FFFDF9", borderRadius: 28, overflow: "hidden", border: "1px solid #DDD5CA", boxShadow: "0 25px 80px rgba(18,17,15,0.28)" },
    modalCardGold: { width: "100%", maxWidth: 420, background: "linear-gradient(160deg,#FFF8E1 0%,#FFF3CC 100%)", borderRadius: 28, overflow: "hidden", border: "2px solid #E8A000", boxShadow: "0 25px 80px rgba(232,160,0,0.3)" },
    modalImage: { height: 190, backgroundImage: "linear-gradient(rgba(245,241,234,0.12),rgba(245,241,234,0.55)),url('/garden.png')", backgroundSize: "cover", backgroundPosition: "center" },
    modalImageGold: { height: 190, background: "linear-gradient(135deg,#E8A000 0%,#F5C842 50%,#E8A000 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 },
    modalBody: { padding: 22 },
    modalTitle: { fontSize: 34, lineHeight: 1, letterSpacing: "-0.05em", fontWeight: 500, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', marginBottom: 8 },
    modalTitleGold: { fontSize: 34, lineHeight: 1, letterSpacing: "-0.05em", fontWeight: 500, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', marginBottom: 8, color: "#7A5200" },
    modalText: { fontSize: 14, color: "#6F6861", lineHeight: 1.5, marginBottom: 16 },
    modalTextGold: { fontSize: 15, color: "#8B6300", lineHeight: 1.5, marginBottom: 16, fontStyle: "italic" },
    modalDate: { background: "#F7F3EC", border: "1px solid #DDD5CA", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#6F6861", marginBottom: 14 },
    footer: { textAlign: "center" as const, fontSize: 12, color: "#A79E93", marginTop: 32, paddingBottom: 16 },
  };

  function renderStepCard(step: 1 | 2 | 3, content: React.ReactNode) {
    const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
    return (
      <div style={S.card}>
        <div style={S.progressWrap}><div style={progressBarStyle(pct)} /></div>
        {content}
      </div>
    );
  }

  // ── ARRIVAL SCREEN ──────────────────────────────────────────────────────
  if (screen === "arrival") {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0B09", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <style>{`
          @keyframes arrivalPulse {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            50% { transform: scale(1.6); opacity: 0.04; }
          }
          @keyframes breatheIn {
            0% { transform: scale(0.92); }
            100% { transform: scale(1.12); }
          }
          @keyframes breatheOut {
            0% { transform: scale(1.12); }
            100% { transform: scale(0.92); }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,140,90,0.08) 0%, transparent 70%)", animation: "arrivalPulse 8s ease-in-out infinite" }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 60, animation: "fadeUp 1s ease forwards" }}>Reset</div>
        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          border: "1px solid rgba(245,241,234,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 40,
          animation: breathePhase === "in" ? "breatheIn 4s ease-in-out forwards" : "breatheOut 4s ease-in-out forwards",
          boxShadow: breathePhase === "in" ? "0 0 60px rgba(180,140,90,0.12)" : "0 0 20px rgba(180,140,90,0.04)",
          transition: "box-shadow 4s ease",
        }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,140,90,0.3) 0%, rgba(180,140,90,0.05) 100%)" }} />
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,241,234,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, animation: "fadeUp 1.5s ease forwards" }}>
          {breathePhase === "in" ? "Breathe in" : "Breathe out"}
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(245,241,234,0.9)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.03em", textAlign: "center", lineHeight: 1.3, marginBottom: 12, maxWidth: 280, animation: "fadeUp 2s ease forwards" }}>
          Before anything else.{"\n"}Just arrive.
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,241,234,0.3)", textAlign: "center", marginBottom: 60, fontStyle: "italic" }}>قبل أي شيء. فقط اوصل.</div>
        <button
          onClick={() => setScreen("presence")}
          disabled={!arrivalUnlocked}
          style={{
            padding: "14px 32px", borderRadius: 999, border: "1px solid rgba(245,241,234,0.2)",
            background: arrivalUnlocked ? "rgba(245,241,234,0.1)" : "transparent",
            color: arrivalUnlocked ? "rgba(245,241,234,0.8)" : "rgba(245,241,234,0.2)",
            fontSize: 14, cursor: arrivalUnlocked ? "pointer" : "default",
            fontFamily: "inherit", letterSpacing: "0.05em", transition: "all 0.8s ease",
          }}
        >
          {arrivalUnlocked ? "I'm here" : "Breathe..."}
        </button>
      </div>
    );
  }

  // ── PRESENCE SCREEN ─────────────────────────────────────────────────────
  if (screen === "presence") {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0B09", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp 0.6s ease forwards" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 40, textAlign: "center" }}>Reset</div>
          <div style={{ fontSize: 26, fontWeight: 500, color: "rgba(245,241,234,0.9)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.03em", textAlign: "center", lineHeight: 1.3, marginBottom: 8 }}>
            How present are you{"\n"}right now?
          </div>
          <div style={{ fontSize: 13, color: "rgba(245,241,234,0.35)", textAlign: "center", marginBottom: 48, fontStyle: "italic" }}>كيف حضورك الآن؟</div>
          <div style={{ display: "grid", gap: 10, marginBottom: 40 }}>
            {[1, 2, 3, 4, 5].map((score) => {
              const info = PRESENCE_LABELS[score];
              const selected = presenceScore === score;
              return (
                <button key={score} onClick={() => setPresenceScore(score)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px", borderRadius: 16,
                  border: selected ? `1px solid ${info.color}` : "1px solid rgba(245,241,234,0.08)",
                  background: selected ? `${info.color}22` : "rgba(245,241,234,0.03)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected ? info.color : "rgba(245,241,234,0.2)" }} />
                    <span style={{ fontSize: 14, color: selected ? "rgba(245,241,234,0.9)" : "rgba(245,241,234,0.45)", fontWeight: selected ? 600 : 400 }}>{info.en}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(245,241,234,0.25)", fontStyle: "italic" }}>{info.ar}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => presenceScore > 0 && setScreen("start")}
            disabled={presenceScore === 0}
            style={{
              width: "100%", padding: "15px 18px", borderRadius: 18, border: "none",
              background: presenceScore > 0 ? "rgba(245,241,234,0.9)" : "rgba(245,241,234,0.1)",
              color: presenceScore > 0 ? "#161413" : "rgba(245,241,234,0.3)",
              fontSize: 15, fontWeight: 800, cursor: presenceScore > 0 ? "pointer" : "default",
              fontFamily: "inherit", transition: "all 0.3s ease",
            }}
          >Continue</button>
        </div>
      </div>
    );
  }

  // ── PULSE FULL SCREEN ────────────────────────────────────────────────────
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
            {profile && <button style={S.profileBtn} onClick={() => setScreen("start")}>← Home</button>}
          </div>
          <PulseScreen onBack={() => setScreen("start")} />
          <div style={S.footer}>For when your head is full and you still need to move.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes goldPulse {
          0%,100% { box-shadow: 0 14px 40px rgba(240,192,64,0.18); }
          50% { box-shadow: 0 14px 55px rgba(240,192,64,0.38); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseLive {
          0%,100%{opacity:1} 50%{opacity:0.4}
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        button:active { transform: scale(0.98); }
      `}</style>
      <div style={S.wrap}>

        <div style={S.topRow}>
          <div style={S.badge}>Reset</div>
          <div style={{ display: "flex", gap: 8 }}>
            {profile && entries.length >= 3 && (
              <button style={S.profileBtn} onClick={() => setScreen("insights")}>Insights</button>
            )}
            {profile && (
              <button style={S.profileBtn} onClick={changeName}>{profile.name} ↩</button>
            )}
          </div>
        </div>

        {screen === "start" && presenceScore > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRESENCE_LABELS[presenceScore]?.color }} />
            <span style={{ fontSize: 12, color: "#6F6861" }}>
              Today: {PRESENCE_LABELS[presenceScore]?.en} · {PRESENCE_LABELS[presenceScore]?.ar}
            </span>
          </div>
        )}

        {screen !== "profile" && (
          <div style={isMilestone ? S.trackerCardMilestone : S.trackerCard}>
            <div style={S.trackerTop}>
              <div>
                <div style={S.label}>Momentum</div>
                <div style={{ ...S.trackerText, marginTop: 3 }}>
                  {streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""} strong` : "Start today"}
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
                <div key={`${day.label}-${idx}`} style={S.trackerDay}>
                  <div style={{ ...S.dot, ...(day.active ? S.dotActive : {}), ...(day.isToday ? S.dotToday : {}) }} />
                  {day.label}
                </div>
              ))}
            </div>
            {isMilestone && <div style={S.milestoneText}>{milestoneLabel}</div>}
          </div>
        )}

        {screen === "start" && streakAtRisk && !hasResetToday && (
          <div style={S.riskBanner}>
            <div style={S.riskText}>You had a streak going. You haven't moved today. One reset keeps it alive.</div>
            <button style={S.riskButton} onClick={() => setScreen("mind")}>Don't break it</button>
          </div>
        )}

        {screen === "checkin" && checkinEntry && (
          <div style={S.checkinCard}>
            <div style={S.checkinBadge}>Daily Check-in</div>
            <div style={S.title}>Yesterday you said "not yet."</div>
            <div style={S.sub}>You said you'd do this:</div>
            <div style={S.checkinMove}>{checkinEntry.move}</div>
            <div style={{ ...S.sub, marginBottom: 20 }}>Did it happen? Or are you still carrying it?</div>
            <button style={S.cta} onClick={resumeCheckin}>Commit to it now</button>
            <button style={S.ctaMuted} onClick={() => setScreen("start")}>Start fresh instead</button>
          </div>
        )}

        {screen === "profile" && (
          <div style={S.card}>
            <div style={S.stepPill}>Name</div>
            <div style={S.title}>What do people call you?</div>
            <div style={S.sub}>Just your first name. This stays on your device.</div>
            <input style={S.input} placeholder="Your name" value={profileName} onChange={(e) => setProfileName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveProfile()} />
            {profileError && <div style={{ color: "#C0392B", fontSize: 13, marginBottom: 10 }}>{profileError}</div>}
            <button style={{ ...S.cta, marginTop: 18 }} onClick={saveProfile}>Start</button>
          </div>
        )}

        {screen === "start" && (
          <>
            <div style={S.heroCard}>
              <div style={S.heroOverlay}>
                <div>
                  <div style={S.heroTitle}>You don't stay stuck.{"\n"}You move.</div>
                  <div style={S.heroSub}>Empty the noise. Name the dodge. Make one clean move.</div>
                </div>
                <div style={S.heroBottom}>
                  <button style={S.startButton} onClick={() => setScreen("mind")}>{hasResetToday ? "Reset again" : "Start Reset"}</button>
                  <div style={S.heroFoot}>This is saved to your reset record.</div>
                </div>
              </div>
            </div>

            {/* ── COMMUNITY PULSE TEASER ── */}
            <PulseTeaser onExpand={() => setScreen("pulse")} />

            {lastNotYet && !hasResetToday && (
              <div style={S.unfinishedCard}>
                <div style={S.label}>Unfinished business</div>
                <div style={S.unfinishedMove}>{lastNotYet.move}</div>
                <div style={S.trackerText}>You said "not yet." Respectfully, the task is still staring.</div>
                <button style={{ ...S.cta, marginTop: 12 }} onClick={resumeLastNotYet}>Resume</button>
              </div>
            )}
            <div style={S.notifRow}>
              <div>
                <div style={S.notifLabel}>Daily reminder at noon</div>
                <div style={S.notifSub}>{notifPermission === "denied" ? "Blocked in browser settings" : notifEnabled ? "You'll get a nudge if you haven't moved" : "Off — tap to enable"}</div>
              </div>
              <div style={S.toggleTrack(notifEnabled)} onClick={notifPermission !== "denied" ? toggleNotifications : undefined} role="switch" aria-checked={notifEnabled}>
                <div style={S.toggleThumb(notifEnabled)} />
              </div>
            </div>
            <button style={S.ctaMuted} onClick={() => setScreen("history")}>View history</button>
          </>
        )}

        {screen === "mind" && renderStepCard(1, <>
          <div style={S.stepPill}>Step 1 / 3</div>
          <div style={S.title}>What's actually in your head?</div>
          <div style={S.sub}>Not everything. Just the loudest thing.</div>
          <div style={S.focusHint}>If you over-explain, you're avoiding.</div>
          <div style={S.chips}>{MIND_SUGGESTIONS.map((opt) => (<button key={opt} type="button" style={{ ...S.chip, ...(mind === opt ? S.chipActive : {}) }} onClick={() => setMind(opt)}>{opt}</button>))}</div>
          <input ref={mindRef} style={S.input} placeholder="The loudest thing right now…" value={mind} maxLength={120} onChange={(e) => setMind(e.target.value)} onKeyDown={(e) => e.key === "Enter" && mind.trim() && setScreen("avoid")} />
          <div style={S.helperRow}><span style={S.helper}>Be specific. Vague = stuck.</span><span style={S.helper}>{mind.length}/120</span></div>
          <button style={{ ...S.cta, ...(mind.trim() ? {} : S.ctaDisabled) }} disabled={!mind.trim()} onClick={() => setScreen("avoid")}>That's it. Continue.</button>
          <button style={S.ctaMuted} onClick={resetFlow}>Cancel</button>
        </>)}

        {screen === "avoid" && renderStepCard(2, <>
          <div style={S.stepPill}>Step 2 / 3</div>
          <div style={S.title}>What are you avoiding?</div>
          <div style={S.sub}>Not the story. The thing itself.</div>
          <div style={S.focusHint}>If you soften it, you'll keep avoiding it.</div>
          <div style={S.chips}>{AVOIDING_SUGGESTIONS.map((opt) => (<button key={opt} type="button" style={{ ...S.chip, ...(avoiding === opt ? S.chipActive : {}) }} onClick={() => setAvoiding(opt)}>{opt}</button>))}</div>
          <input ref={avoidRef} style={S.input} placeholder="What you keep not doing…" value={avoiding} maxLength={120} onChange={(e) => setAvoiding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && avoiding.trim() && setScreen("move")} />
          <div style={S.helperRow}><span style={S.helper}>Name it exactly.</span><span style={S.helper}>{avoiding.length}/120</span></div>
          <button style={{ ...S.cta, ...(avoiding.trim() ? {} : S.ctaDisabled) }} disabled={!avoiding.trim()} onClick={() => setScreen("move")}>Got it. Next.</button>
          <button style={S.ctaMuted} onClick={() => setScreen("mind")}>← Back</button>
        </>)}

        {screen === "move" && renderStepCard(3, <>
          <div style={S.stepPill}>Step 3 / 3</div>
          <div style={S.title}>What's the smallest move?</div>
          <div style={S.sub}>Not the plan. Just the first step.</div>
          <div style={S.focusHint}>If it feels big, you won't do it.</div>
          <div style={S.chips}>{MOVE_SUGGESTIONS.map((opt) => (<button key={opt} type="button" style={{ ...S.chip, ...(move === opt ? S.chipActive : {}) }} onClick={() => setMove(opt)}>{opt}</button>))}</div>
          <input ref={moveRef} style={S.input} placeholder="One tiny action…" value={move} maxLength={120} onChange={(e) => setMove(e.target.value)} onKeyDown={(e) => e.key === "Enter" && move.trim() && beginCommit()} />
          <div style={S.helperRow}><span style={S.helper}>Embarrassingly small is right.</span><span style={S.helper}>{move.length}/120</span></div>
          <button style={{ ...S.cta, ...(move.trim() ? {} : S.ctaDisabled) }} disabled={!move.trim()} onClick={beginCommit}>Commit.</button>
          <button style={S.ctaMuted} onClick={() => setScreen("avoid")}>← Back</button>
        </>)}

        {screen === "commit" && (
          <div style={{ ...S.card, ...S.commitCard }}>
            <div style={{ ...S.stepPill, ...S.stepPillDark }}>No more thinking.</div>
            <div style={S.title}>Do this now.</div>
            <div style={{ ...S.sub, ...S.subDark }}>Start before you feel ready.</div>
            <div style={S.moveBox}>
              <div style={{ ...S.label, color: "#A79E93", marginBottom: 8 }}>Your move</div>
              <div style={S.moveBig}>{move}</div>
            </div>
            {countdown > 0 ? (
              <>
                <div style={S.breatheRing(breathePhase)}><div style={S.breatheNum}>{countdown}</div></div>
                <div style={S.breatheLabel}>{breathePhase === "in" ? "BREATHE IN" : "BREATHE OUT"}</div>
              </>
            ) : (
              <div style={S.statusRow}>
                <button style={S.statusPrimary} onClick={() => saveResult("done")}>I did it</button>
                <button style={S.statusSecondary} onClick={() => saveResult("not_yet")}>I didn't</button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && latestEntry && (
          <div style={S.card}>
            <div style={S.stepPill}>Feedback</div>
            <div style={S.title}>{latestEntry.status === "done" ? "You moved." : "You're still avoiding."}</div>
            <div style={S.aiFeedbackBox}>
              <div style={S.aiBadge}>AI Insight</div>
              {aiFeedbackLoading ? (
                <div style={{ ...S.feedbackText, color: "#A79E93", fontStyle: "italic" }}>Thinking about what you just did...</div>
              ) : (
                <div style={S.feedbackText}>{aiFeedback}</div>
              )}
            </div>
            {latestEntry.status === "done" && streak > 0 && (
              <div style={{ ...S.resultBox, background: streak >= 7 ? "#FFF8E1" : "#F7F3EC", border: streak >= 7 ? "1px solid #F0C040" : "1px solid #DDD5CA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={S.label}>Current streak</div>
                  <div style={{ ...S.unfinishedMove, marginBottom: 0, color: streak >= 7 ? "#7A5200" : "#161413" }}>{streak} day{streak !== 1 ? "s" : ""}</div>
                </div>
                {streak >= 7 && <div style={{ fontSize: 28 }}>★</div>}
              </div>
            )}
            <div style={S.shareBox}>
              <div style={S.shareTitle}>Accountability</div>
              <div style={S.shareText}>Send it to one person. Make it harder to disappear.</div>
              <button style={S.cta} onClick={shareMove}>{shareCopied ? "Copied" : "Share my move"}</button>
            </div>
            <button style={S.ctaMuted} onClick={resetFlow}>Back to start</button>
          </div>
        )}

        {screen === "insights" && (
          <div style={S.card}>
            <div style={S.stepPill}>Your patterns</div>
            <div style={S.title}>What the data says.</div>
            <div style={S.sub}>Based on your last {Math.min(entries.length, 50)} resets.</div>
            <div style={S.summaryGrid}>
              {[
                { num: totalResets, label: "Total resets" },
                { num: `${patterns.completionRate}%`, label: "Done rate" },
                { num: streak, label: "Day streak" },
                { num: patterns.avgPresence > 0 ? `${patterns.avgPresence}/5` : "—", label: "Avg presence" },
              ].map(({ num, label }) => (
                <div key={label} style={S.summaryBox}>
                  <div style={S.summaryNum}>{num}</div>
                  <div style={S.summaryLabel}>{label}</div>
                </div>
              ))}
            </div>
            {patterns.topAvoiding && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>🔁</div>
                <div>
                  <div style={S.insightTitle}>You keep avoiding this</div>
                  <div style={S.insightBody}>"{patterns.topAvoiding}" shows up more than anything else. It's not a task problem — it's a resistance pattern.</div>
                </div>
              </div>
            )}
            {patterns.avgPresence > 0 && patterns.avgPresence < 3 && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>🌫️</div>
                <div>
                  <div style={S.insightTitle}>You're often scattered</div>
                  <div style={S.insightBody}>Your average presence is {patterns.avgPresence}/5. The arrival practice matters most for you — don't skip it.</div>
                </div>
              </div>
            )}
            {patterns.avgPresence >= 4 && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>🎯</div>
                <div>
                  <div style={S.insightTitle}>You arrive well</div>
                  <div style={S.insightBody}>Average presence {patterns.avgPresence}/5. You're doing the inner work. That's rare.</div>
                </div>
              </div>
            )}
            {patterns.mostProductiveDays.length > 0 && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>📅</div>
                <div>
                  <div style={S.insightTitle}>Your best days</div>
                  <div style={S.insightBody}>You complete moves most on {patterns.mostProductiveDays.join(" and ")}. Schedule your hardest tasks then.</div>
                </div>
              </div>
            )}
            {patterns.completionRate < 50 && entries.length >= 5 && (
              <div style={S.insightRow}>
                <div style={S.insightIcon}>🎯</div>
                <div>
                  <div style={S.insightTitle}>Your moves are too big</div>
                  <div style={S.insightBody}>{100 - patterns.completionRate}% of the time you don't follow through. Make the move smaller.</div>
                </div>
              </div>
            )}
            <button style={S.ctaMuted} onClick={() => setScreen("start")}>← Back</button>
          </div>
        )}

        {screen === "history" && (
          <div style={S.card}>
            <div style={S.stepPill}>History</div>
            <div style={S.title}>Here's what happened.</div>
            <div style={S.sub}>No story. Just the pattern.</div>
            {entries.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                {[{ num: totalResets, label: "Total" }, { num: doneCount, label: "Done" }, { num: streak, label: "Streak" }].map(({ num, label }) => (
                  <div key={label} style={S.summaryBox}><div style={S.summaryNum}>{num}</div><div style={S.summaryLabel}>{label}</div></div>
                ))}
              </div>
            )}
            <div style={S.historyList}>
              {entries.length === 0 ? (
                <div style={S.emptyState}>No resets yet. Do your first one.</div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} style={S.historyCard}>
                    <div style={S.historyTop}>
                      <span style={S.historyDate}>{formatDate(entry.createdAt)}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {entry.presenceScore && (
                          <span style={{ fontSize: 11, color: PRESENCE_LABELS[entry.presenceScore]?.color, fontWeight: 700 }}>
                            {entry.presenceScore}/5
                          </span>
                        )}
                        <span style={S.statusBadge(entry.status)}>{entry.status === "done" ? "Done" : "Not yet"}</span>
                      </div>
                    </div>
                    <div style={S.historyLine}><span style={S.historyLineLabel}>Mind </span>{entry.mind}</div>
                    <div style={S.historyLine}><span style={S.historyLineLabel}>Avoiding </span>{entry.avoiding}</div>
                    <div style={S.historyLine}><span style={S.historyLineLabel}>Move </span>{entry.move}</div>
                    <div style={{ ...S.historyLine, marginBottom: 0 }}><span style={S.historyLineLabel}>Feedback </span>{entry.feedback}</div>
                  </div>
                ))
              )}
            </div>
            <button style={{ ...S.ctaMuted, marginTop: 12 }} onClick={() => setScreen("start")}>← Back</button>
          </div>
        )}

        {showResultPopup && latestEntry && !showMilestone && (
          <div style={S.modalBackdrop}>
            <div style={S.modalCard}>
              <div style={S.modalImage} />
              <div style={S.modalBody}>
                <div style={S.modalTitle}>{latestEntry.status === "done" ? "Done." : "Not yet."}</div>
                <div style={S.modalText}>{latestEntry.status === "done" ? "The move is made. That's all it takes." : "Sit with it. Then make the move smaller."}</div>
                <div style={S.summaryGrid}>
                  {[{ num: totalResets, label: "Total resets" }, { num: doneCount, label: "Completed" }, { num: notYetCount, label: "Not yet" }, { num: streak, label: "Day streak" }].map(({ num, label }) => (
                    <div key={label} style={S.summaryBox}><div style={S.summaryNum}>{num}</div><div style={S.summaryLabel}>{label}</div></div>
                  ))}
                </div>
                <div style={S.modalDate}>Latest reset: {latestResetTime}</div>
                <button style={S.cta} onClick={() => setShowResultPopup(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showMilestone && latestEntry && (
          <div style={S.modalBackdrop}>
            <div style={S.modalCardGold}>
              <div style={S.modalImageGold}>★</div>
              <div style={S.modalBody}>
                <div style={S.modalTitleGold}>{streak} days. Remarkable.</div>
                <div style={S.modalTextGold}>{getMilestoneLabel(streak)}</div>
                <div style={S.summaryGrid}>
                  {[{ num: streak, label: "Day streak" }, { num: doneCount, label: "Completed" }, { num: totalResets, label: "Total resets" }, { num: notYetCount, label: "Not yet" }].map(({ num, label }) => (
                    <div key={label} style={S.summaryBoxGold}><div style={S.summaryNumGold}>{num}</div><div style={S.summaryLabelGold}>{label}</div></div>
                  ))}
                </div>
                <div style={{ ...S.modalDate, background: "rgba(232,160,0,0.1)", border: "1px solid rgba(232,160,0,0.3)", color: "#8B6300" }}>Latest reset: {latestResetTime}</div>
                <button style={S.ctaGold} onClick={() => setShowMilestone(false)}>Keep going</button>
              </div>
            </div>
          </div>
        )}

        <div style={S.footer}>For when your head is full and you still need to move.</div>
      </div>
    </div>
  );
}

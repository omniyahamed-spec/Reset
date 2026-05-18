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

function PulseTeaser({ onExpand }: { onExpand: () => void }) {
  const [barsVisible, setBarsVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: "#161413", borderRadius: 24, padding: "20px 22px",
      marginBottom: 14, border: "1px solid #2A2520",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40, width: 160, height: 160,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,120,50,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.35)", marginBottom: 4 }}>
            Community pulse
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(245,241,234,0.88)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            What others are doing right now
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px rgba(76,175,80,0.6)", animation: "pulseLive 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, color: "rgba(245,241,234,0.4)", letterSpacing: "0.04em" }}>1,240 today</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
        {[{ num: "11", label: "avg streak" }, { num: "78%", label: "completed" }, { num: "9 AM", label: "peak hour" }].map(({ num, label }) => (
          <div key={label} style={{ background: "rgba(245,241,234,0.04)", border: "1px solid rgba(245,241,234,0.07)", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: "rgba(245,241,234,0.85)", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif' }}>{num}</div>
            <div style={{ fontSize: 10, color: "rgba(245,241,234,0.3)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.3)", marginBottom: 12 }}>
          Most avoided this week
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "rgba(245,241,234,0.55)" }}>{item.label}</span>
                <span style={{ fontSize: 12, color: "rgba(245,241,234,0.3)" }}>{item.pct}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(245,241,234,0.07)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: i === 0 ? "rgba(180,120,50,0.7)" : i === 1 ? "rgba(245,241,234,0.25)" : "rgba(245,241,234,0.13)",
                  width: barsVisible ? `${item.pct}%` : "0%",
                  transition: `width 0.9s ease ${i * 0.12}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 16 }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(180,120,50,0.12)", border: "1px solid rgba(180,120,50,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: "rgba(200,150,70,0.8)" }}>↑</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(245,241,234,0.75)", marginBottom: 3 }}>Monday resets build streaks</div>
          <div style={{ fontSize: 12, color: "rgba(245,241,234,0.35)", lineHeight: 1.55 }}>People who reset on Monday are 2× more likely to still be going by Friday.</div>
        </div>
      </div>
      <button
        onClick={onExpand}
        style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(245,241,234,0.1)", background: "rgba(245,241,234,0.04)", color: "rgba(245,241,234,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        See full community map <span style={{ fontSize: 11, opacity: 0.6 }}>→</span>
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
    <div style={{ background: "#161413", borderRadius: 28, padding: "24px 22px", border: "1px solid #2A2520", marginBottom: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,120,50,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.3)", marginBottom: 6 }}>Community pulse</div>
          <div style={{ fontSize: 26, fontWeight: 500, color: "rgba(245,241,234,0.9)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.03em", lineHeight: 1.15 }}>How the world resets.</div>
          <div style={{ fontSize: 13, color: "rgba(245,241,234,0.3)", fontStyle: "italic", marginTop: 4 }}>كيف يعيد الناس ضبط أنفسهم</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px rgba(76,175,80,0.6)", animation: "pulseLive 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, color: "rgba(245,241,234,0.35)" }}>Live</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { num: "1,240", label: "Resets today", sub: "across all users" },
          { num: "78%", label: "Completed today", sub: "marked as done" },
          { num: "11 days", label: "Average streak", sub: "among active users" },
          { num: "9 AM", label: "Peak reset time", sub: "most users arrive early" },
        ].map(({ num, label, sub }) => (
          <div key={label} style={{ background: "rgba(245,241,234,0.03)", border: "1px solid rgba(245,241,234,0.07)", borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: "rgba(245,241,234,0.88)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.04em", lineHeight: 1 }}>{num}</div>
            <div style={{ fontSize: 12, color: "rgba(245,241,234,0.6)", marginTop: 5, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 11, color: "rgba(245,241,234,0.25)", marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.3)", marginBottom: 14 }}>Most avoided this week</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {PULSE_AVOIDANCES.map((item, i) => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "rgba(245,241,234,0.6)" }}>{item.label}</span>
                <span style={{ fontSize: 13, color: i === 0 ? "rgba(200,150,70,0.8)" : "rgba(245,241,234,0.3)", fontWeight: i === 0 ? 700 : 400 }}>{item.pct}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(245,241,234,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: i === 0 ? "linear-gradient(90deg,rgba(180,120,50,0.8),rgba(220,160,60,0.6))" : i === 1 ? "rgba(245,241,234,0.22)" : i === 2 ? "rgba(245,241,234,0.14)" : "rgba(245,241,234,0.08)",
                  width: barsVisible ? `${item.pct}%` : "0%",
                  transition: `width 1s ease ${i * 0.15}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 20 }} />
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.3)", marginBottom: 14 }}>Behavioural patterns</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          {PULSE_INSIGHTS.map((ins) => (
            <div key={ins.title} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(180,120,50,0.1)", border: "1px solid rgba(180,120,50,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, color: "rgba(200,150,70,0.75)" }}>{ins.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(245,241,234,0.78)", marginBottom: 3 }}>{ins.title}</div>
                <div style={{ fontSize: 12, color: "rgba(245,241,234,0.38)", lineHeight: 1.6 }}>{ins.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(245,241,234,0.3)", marginBottom: 12 }}>How people arrive</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {[
            { label: "Fully arrived", pct: 18, score: 5 },
            { label: "Mostly present", pct: 34, score: 4 },
            { label: "Halfway here", pct: 28, score: 3 },
            { label: "Scattered", pct: 14, score: 2 },
            { label: "Completely lost", pct: 6, score: 1 },
          ].map((item) => {
            const colors: Record<number, string> = { 5: "rgba(26,58,92,0.8)", 4: "rgba(46,94,46,0.7)", 3: "rgba(122,98,0,0.7)", 2: "rgba(184,92,0,0.65)", 1: "rgba(139,30,30,0.65)" };
            return (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 90, fontSize: 11, color: "rgba(245,241,234,0.4)", textAlign: "right" as const }}>{item.label}</div>
                <div style={{ flex: 1, height: 6, background: "rgba(245,241,234,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: colors[item.score], width: barsVisible ? `${item.pct}%` : "0%", transition: `width 1s ease ${item.score * 0.1}s` }} />
                </div>
                <div style={{ width: 28, fontSize: 11, color: "rgba(245,241,234,0.3)" }}>{item.pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(245,241,234,0.06)", marginBottom: 16 }} />
      <div style={{ fontSize: 11, color: "rgba(245,241,234,0.2)", lineHeight: 1.6, marginBottom: 18, fontStyle: "italic", textAlign: "center" as const }}>
        Data is anonymous and aggregated. No individual entries are visible to others.
      </div>
      <button onClick={onBack} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "1px solid rgba(245,241,234,0.12)", background: "transparent", color: "rgba(245,241,234,0.45)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
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
      setBreatheCount(c => { const next = c + 1; if (next >= 3) setArrivalUnlocked(true); return next; });
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
    const hasResetToday = entries.some((e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const hadYesterday = entries.some((e) => e.status === "done" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime());
    if (hadYesterday && !hasResetToday) setStreakAtRisk(true);
    const yesterdayNotYet = entries.find((e) => e.status === "not_yet" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime());
    if (yesterdayNotYet && !hasResetToday) { setCheckinEntry(yesterdayNotYet); setScreen("checkin"); }
    else if (!hasResetToday) { setScreen("arrival"); }
    else { setScreen("start"); }
    checkAndFireReminder(profile.name, hasResetToday);
  }, [loading, profile, entries.length]); // eslint-disable-line

  async function loadEntries(profileId: string) {
    const { data, error } = await supabase.from("entries").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(50);
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
      setCountdown((prev) => { const next = prev - 1; setBreathePhase((p) => (next % 2 === 0 ? (p === "in" ? "out" : "in") : p)); return next; });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown]);

  const latestEntry = useMemo(() => (latestId ? entries.find((e) => e.id === latestId) ?? null : null), [entries, latestId]);
  const doneCount = useMemo(() => entries.filter((e) => e.status === "done").length, [entries]);
  const notYetCount = useMemo(() => entries.filter((e) => e.status === "not_yet").length, [entries]);
  const totalResets = entries.length;
  const lastNotYet = useMemo(() => entries.find((e) => e.status === "not_yet"), [entries]);
  const latestResetTime = latestEntry ? new Date(latestEntry.createdAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const hasResetToday = useMemo(() => entries.some((e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime()), [entries]);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 100; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const has = entries.some((e) => e.status === "done" && startOfDay(new Date(e.createdAt)).getTime() === startOfDay(d).getTime());
      if (has) s++; else break;
    }
    return s;
  }, [entries]);

  const trackerDays = useMemo(() => {
    const days: { label: string; active: boolean; isToday: boolean; presence?: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const dayEntries = entries.filter((e) => startOfDay(new Date(e.createdAt)).getTime() === startOfDay(day).getTime());
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
    const { data, error } = await supabase.from("entries").insert({ profile_id: profile.id, mind: mind.trim(), avoiding: avoiding.trim(), move: move.trim(), status, feedback: "...", presence_score: presenceScore || null }).select().single();
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
    return <div style={S.card}><div style={S.progressWrap}><div style={progressBarStyle(pct)} /></div>{content}</div>;
  }

  if (screen === "arrival") {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0B09", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <style>{`
          @keyframes arrivalPulse { 0%,100%{transform:scale(1);opacity:0.15} 50%{transform:scale(1.6);opacity:0.04} }
          @keyframes breatheIn { 0%{transform:scale(0.92)} 100%{transform:scale(1.12)} }
          @keyframes breatheOut { 0%{transform:scale(1.12)} 100%{transform:scale(0.92)} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,140,90,0.08) 0%, transparent 70%)", animation: "arrivalPulse 8s ease-in-out infinite" }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,241,234,0.3)", marginBottom: 60, animation: "fadeUp 1s ease forwards" }}>Reset</div>
        <div style={{ width: 120, height: 120, borderRadius: "50%", border: "1px solid rgba(245,241,234,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40, animation: breathePhase === "in" ? "breatheIn 4s ease-in-out forwards" : "breatheOut 4s ease-in-out forwards", boxShadow: breathePhase === "in" ? "0 0 60px rgba(180,140,90,0.12)" : "0 0 20px rgba(180,140,90,0.04)", transition: "box-shadow 4s ease" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,140,90,0.3) 0%, rgba(180,140,90,0.05) 100%)" }} />
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,241,234,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{breathePhase === "in" ? "Breathe in" : "Breathe out"}</div>
        <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(245,241,234,0.9)", fontFamily: 'Iowan Old Style,"Palatino Linotype","Book Antiqua",Georgia,serif', letterSpacing: "-0.03em", textAlign: "center", lineHeight: 1.3, marginBottom: 12, maxWidth: 280 }}>Before anything else.{"\n"}Just arrive.</div>
        <div style={{ fontSize: 13, color: "rgba(245,241,234,0.3)", textAlign: "center", marginBottom: 60, fontStyle: "italic" }}>قبل أي شيء. فقط اوصل.</div>
        <bu

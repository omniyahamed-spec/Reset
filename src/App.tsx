import { CSSProperties, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

type Screen =
  | "profile"
  | "start"
  | "mind"
  | "avoid"
  | "move"
  | "commit"
  | "result"
  | "history"
  | "checkin";

type EntryStatus = "done" | "not_yet";

interface Entry {
  id: number;
  createdAt: string;
  mind: string;
  avoiding: string;
  move: string;
  status: EntryStatus;
  feedback: string;
}

interface Profile {
  id: string;
  name: string;
}

const MIND_SUGGESTIONS = ["Too much in my head", "I feel off", "I keep circling this"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

const COMMIT_SECONDS = 5;
const DAILY_REMINDER_HOUR = 12;
const MILESTONE_DAYS = [7, 14, 30, 60, 100];

function makeProfileId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
  if (streak === 60) return "60 days. You are genuinely dangerous.";
  if (streak === 100) return "100. That is not a habit. That is identity.";
  return null;
}

function progressBarStyle(pct: number): CSSProperties {
  return {
    height: "100%",
    background: "#23201D",
    borderRadius: 999,
    width: `${pct}%`,
    transition: "width 0.4s ease",
  };
}

function generateFeedback(
  status: EntryStatus,
  mind: string,
  avoiding: string,
  move: string,
  seed: number
): string {
  const cleanAvoiding = avoiding.trim().toLowerCase();
  const cleanMove = move.trim();

  const doneLines = [
    `Look at you, actually becoming evidence. "${cleanMove}" happened. We may need to inform your excuses they lost today.`,
    `You moved. Tiny? Maybe. Real? Yes. Your avoidance department is filing a complaint.`,
    `Done. Not dramatic, not cinematic, but annoyingly effective. This is how people become dangerous.`,
    `You did it. The brain wanted a full committee meeting. You chose action. Excellent governance.`,
    `That counts. Your future self just raised one eyebrow and said, "Finally."`,
    `You acted before the spiral finished its TED Talk. Strong move.`,
  ];

  const notYetLines = [
    `Not yet. Fine. But let's not call it confusion. The move is probably too big or your excuse has better branding.`,
    `Still parked. Make the move smaller. If it feels embarrassing, perfect — that means it might actually happen.`,
    `You didn't do it. No tragedy. Just data. The task needs to be cut in half before your brain starts negotiating again.`,
    `Avoidance won this round. Narrow victory. Shrink the move and ask for a rematch.`,
    `Not yet means the action was too expensive emotionally. Make it cheaper. Ridiculously cheaper.`,
    `You are not lazy. You are overcomplicating the doorway. Use the smaller door.`,
  ];

  const avoidanceLines: Record<string, string[]> = {
    starting: [
      `Classic. "Starting" — the tiny villain wearing a very expensive costume.`,
      `Starting again? The beginning is not a monster. It just has bad PR.`,
    ],
    "a message": [
      `A message. Of course. Humanity built satellites, but one text still has everyone acting haunted.`,
      `The message will not explode. Probably. Send the clean version, not the perfect version.`,
    ],
    "a decision": [
      `A decision. Translation: you already know, but you want the universe to co-sign the invoice.`,
      `Decisions get heavier when you keep carrying them around. Put this one down.`,
    ],
  };

  const specific = avoidanceLines[cleanAvoiding]?.[seed % avoidanceLines[cleanAvoiding].length];
  if (specific) return specific;

  const source = status === "done" ? doneLines : notYetLines;
  return source[seed % source.length];
}

function mapEntry(row: any): Entry {
  return {
    id: row.id,
    createdAt: row.created_at,
    mind: row.mind,
    avoiding: row.avoiding,
    move: row.move,
    status: row.status,
    feedback: row.feedback,
  };
}

// ── Push notification helpers ──────────────────────────────────────────────
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function scheduleLocalReminder(profileName: string) {
  // Store the reminder preference; a SW or a simple interval on next load fires it
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

  if (lastFired === today) return; // Already fired today
  if (hour < DAILY_REMINDER_HOUR) return; // Not noon yet
  if (hasResetToday) return; // Already reset today

  localStorage.setItem("reset_reminder_last_fired", today);
  new Notification("Reset — your daily check-in", {
    body: `Hey ${profileName}. Head full? Name the dodge. Make one move.`,
    icon: "/favicon.ico",
    tag: "reset-daily",
  });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("profile");
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileError, setProfileError] = useState("");

  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [countdown, setCountdown] = useState(COMMIT_SECONDS);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [breathePhase, setBreathePhase] = useState<"in" | "out">("in");
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [checkinEntry, setCheckinEntry] = useState<Entry | null>(null);

  const mindRef = useRef<HTMLInputElement>(null);
  const avoidRef = useRef<HTMLInputElement>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const savedProfileId = localStorage.getItem("reset_profile_id");
      const reminderEnabled = localStorage.getItem("reset_reminder_enabled") === "true";
      setNotifEnabled(reminderEnabled);

      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }

      if (!savedProfileId) {
        setScreen("profile");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", savedProfileId)
        .maybeSingle();

      if (error || !data) {
        localStorage.removeItem("reset_profile_id");
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

  // After entries load, decide what screen to show
  useEffect(() => {
    if (loading || !profile) return;

    const hasResetToday = entries.some(
      (e) =>
        startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime()
    );

    // Check if streak is at risk (had a streak yesterday but not today)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const hadYesterday = entries.some(
      (e) =>
        e.status === "done" &&
        startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime()
    );

    if (hadYesterday && !hasResetToday) {
      setStreakAtRisk(true);
    }

    // Daily check-in: find yesterday's not_yet entry
    const yesterdayNotYet = entries.find(
      (e) =>
        e.status === "not_yet" &&
        startOfDay(new Date(e.createdAt)).getTime() === startOfDay(yesterday).getTime()
    );

    if (yesterdayNotYet && !hasResetToday) {
      setCheckinEntry(yesterdayNotYet);
      setScreen("checkin");
    } else {
      setScreen("start");
    }

    // Fire reminder if applicable
    checkAndFireReminder(profile.name, hasResetToday);
  }, [loading, profile, entries.length]);

  async function loadEntries(profileId: string) {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to load entries", error);
      setEntries([]);
      return;
    }

    setEntries((data ?? []).map(mapEntry));
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
    () => entries.find((e) => e.id === latestId) ?? null,
    [entries, latestId]
  );

  const doneCount = useMemo(() => entries.filter((e) => e.status === "done").length, [entries]);
  const notYetCount = useMemo(() => entries.filter((e) => e.status === "not_yet").length, [entries]);
  const totalResets = entries.length;

  const lastNotYet = useMemo(() => entries.find((e) => e.status === "not_yet"), [entries]);

  const latestResetTime = latestEntry
    ? new Date(latestEntry.createdAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 100; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const has = entries.some(
        (e) =>
          e.status === "done" &&
          startOfDay(new Date(e.createdAt)).getTime() === startOfDay(d).getTime()
      );
      if (has) s++;
      else break;
    }
    return s;
  }, [entries]);

  const trackerDays = useMemo(() => {
    const days: { label: string; active: boolean; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const active = entries.some(
        (e) =>
          e.status === "done" &&
          startOfDay(new Date(e.createdAt)).getTime() === startOfDay(day).getTime()
      );
      days.push({ label, active, isToday: i === 0 });
    }
    return days;
  }, [entries]);

  const hasResetToday = useMemo(
    () =>
      entries.some(
        (e) =>
          startOfDay(new Date(e.createdAt)).getTime() === startOfDay(new Date()).getTime()
      ),
    [entries]
  );

  const milestoneLabel = getMilestoneLabel(streak);
  const isMilestone = milestoneLabel !== null;

  async function saveProfile() {
    setProfileError("");
    if (!profileName.trim()) {
      setProfileError("Name is required.");
      return;
    }
    const id = makeProfileId(profileName);
    const payload = { id, name: profileName.trim() };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      setProfileError(error.message);
      return;
    }

    localStorage.setItem("reset_profile_id", id);
    setProfile(data as Profile);
    await loadEntries(id);
    setScreen("start");
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
    setBreathePhase("in");
    setLatestId(null);
    setShareCopied(false);
    setShowResultPopup(false);
    setShowMilestone(false);
    setScreen(profile ? "start" : "profile");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
  }

  async function saveResult(status: EntryStatus) {
    if (!profile) {
      setScreen("profile");
      return;
    }

    const seed = Date.now();
    const feedback = generateFeedback(status, mind, avoiding, move, seed);
    const payload = {
      profile_id: profile.id,
      mind: mind.trim(),
      avoiding: avoiding.trim(),
      move: move.trim(),
      status,
      feedback,
    };

    const { data, error } = await supabase
      .from("entries")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert("The entry did not save. Check Supabase table or policies.");
      return;
    }

    const newEntry = mapEntry(data);
    setEntries((prev) => [newEntry, ...prev].slice(0, 50));
    setLatestId(newEntry.id);

    // Check for milestone AFTER updating streak
    const newStreak = status === "done" ? streak + 1 : streak;
    if (status === "done" && MILESTONE_DAYS.includes(newStreak)) {
      setShowMilestone(true);
    } else {
      setShowResultPopup(true);
    }

    setScreen("result");
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
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
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
    } catch (error) {
      console.error("Share failed", error);
    }
  }

  const today = new Date();

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#F5F1EA",
      color: "#161413",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "20px 14px 48px",
      boxSizing: "border-box",
    },
    wrap: {
      maxWidth: 560,
      margin: "0 auto",
    },
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    badge: {
      display: "inline-block",
      border: "1px solid #DDD5CA",
      background: "#FFFDF9",
      color: "#6F6861",
      borderRadius: 999,
      padding: "7px 11px",
      fontSize: 11,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
    },
    date: {
      fontSize: 12,
      color: "#6F6861",
    },
    // ── Streak tracker ────────────────────────────────────────────────────
    trackerCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(35, 32, 29, 0.05)",
    },
    trackerCardMilestone: {
      background: "linear-gradient(135deg, #FFF8E1 0%, #FFF3CC 50%, #FFFDF9 100%)",
      border: "1.5px solid #F0C040",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(240, 192, 64, 0.18)",
      animation: "goldPulse 2s ease-in-out infinite",
    },
    trackerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      flexWrap: "wrap",
    },
    label: {
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#6F6861",
      fontWeight: 700,
      marginBottom: 6,
    },
    trackerText: {
      fontSize: 13,
      color: "#6F6861",
    },
    streakPill: {
      display: "inline-block",
      background: "#23201D",
      color: "#FFFDF9",
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
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
    },
    trackerDay: {
      textAlign: "center",
      fontSize: 10,
      color: "#6F6861",
    },
    dot: {
      width: 11,
      height: 11,
      borderRadius: 999,
      background: "#DDD5CA",
      margin: "0 auto 6px",
    },
    dotActive: {
      background: "#23201D",
    },
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
    // ── Streak at risk banner ─────────────────────────────────────────────
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
      whiteSpace: "nowrap",
    },
    // ── Notification toggle ───────────────────────────────────────────────
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
    notifLabel: {
      fontSize: 13,
      color: "#23201D",
      fontWeight: 600,
    },
    notifSub: {
      fontSize: 11,
      color: "#6F6861",
      marginTop: 2,
    },
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
    // ── Check-in screen ───────────────────────────────────────────────────
    checkinCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 24,
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
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
      textTransform: "uppercase",
      color: "#6F6861",
      marginBottom: 14,
    },
    checkinMove: {
      fontSize: 24,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      margin: "10px 0 6px",
      letterSpacing: "-0.03em",
    },
    // ── Hero ──────────────────────────────────────────────────────────────
    heroCard: {
      position: "relative",
      minHeight: 580,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: "#EDE7DE",
      backgroundImage:
        "linear-gradient(rgba(245,241,234,0.45), rgba(245,241,234,0.75)), url('/garden.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      border: "1px solid #DDD5CA",
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
      display: "flex",
      alignItems: "stretch",
      marginBottom: 10,
    },
    heroOverlay: {
      width: "100%",
      padding: 28,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    heroTitle: {
      fontSize: "clamp(40px, 9vw, 58px)",
      lineHeight: 0.96,
      letterSpacing: "-0.06em",
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      maxWidth: 320,
      color: "#161413",
      marginBottom: 16,
      whiteSpace: "pre-line",
    },
    heroSub: {
      fontSize: 15,
      lineHeight: 1.55,
      color: "#2B2723",
      maxWidth: 260,
    },
    heroBottom: { maxWidth: 320 },
    startButton: {
      width: "100%",
      padding: "18px 20px",
      borderRadius: 999,
      border: "none",
      background: "#161413",
      color: "#FFFDF9",
      fontSize: 18,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      cursor: "pointer",
      marginBottom: 12,
    },
    heroFoot: {
      fontSize: 13,
      color: "#2B2723",
      textAlign: "center",
    },
    unfinishedCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
    },
    unfinishedMove: {
      fontSize: 20,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 10,
    },
    card: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 24,
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
    },
    commitCard: {
      background: "#12110F",
      color: "#F3ECE3",
      border: "1px solid #2A2724",
      boxShadow: "0 18px 50px rgba(18, 17, 15, 0.22)",
    },
    progressWrap: {
      height: 3,
      background: "#EDE7DE",
      borderRadius: 999,
      marginBottom: 20,
      overflow: "hidden",
    },
    stepPill: {
      display: "inline-block",
      padding: "7px 12px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      background: "#F1ECE4",
      color: "#6F6861",
      marginBottom: 14,
    },
    stepPillDark: {
      background: "rgba(255,255,255,0.08)",
      color: "#A79E93",
    },
    title: {
      fontSize: "clamp(28px, 6vw, 38px)",
      lineHeight: 0.98,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
    },
    sub: {
      fontSize: 14,
      color: "#6F6861",
      lineHeight: 1.55,
      marginBottom: 14,
      maxWidth: 420,
    },
    subDark: { color: "#A79E93" },
    focusHint: {
      fontSize: 12,
      color: "#6F6861",
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 10,
      padding: "8px 12px",
      marginBottom: 14,
      lineHeight: 1.5,
    },
    chips: {
      display: "flex",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 10,
    },
    chip: {
      padding: "9px 13px",
      borderRadius: 999,
      border: "1px solid #DDD5CA",
      background: "#F7F3EC",
      color: "#23201D",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    },
    chipActive: {
      background: "#23201D",
      color: "#FFFDF9",
      border: "1px solid #23201D",
    },
    input: {
      width: "100%",
      padding: "15px 0 11px",
      border: "none",
      borderBottom: "1.5px solid #CFC5B7",
      background: "transparent",
      color: "#161413",
      fontSize: 19,
      lineHeight: 1.4,
      boxSizing: "border-box",
      outline: "none",
      borderRadius: 0,
      fontFamily: "inherit",
    },
    charCount: {
      fontSize: 11,
      color: "#B5ADA6",
      textAlign: "right",
    },
    helperRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      marginBottom: 16,
    },
    helper: { fontSize: 12, color: "#736C64" },
    cta: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: "none",
      background: "#23201D",
      color: "#FFFDF9",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    ctaDisabled: { opacity: 0.38, cursor: "not-allowed" },
    ctaMuted: {
      width: "100%",
      padding: "13px 18px",
      borderRadius: 16,
      border: "1px solid #DDD5CA",
      background: "transparent",
      color: "#6F6861",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      marginTop: 9,
      fontFamily: "inherit",
    },
    moveBox: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
    },
    moveBig: {
      fontSize: 26,
      lineHeight: 1.15,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      letterSpacing: "-0.04em",
    },
    breathingWrap: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 0 20px",
    },
    breatheLabel: {
      fontSize: 11,
      color: "#A79E93",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 10,
    },
    breathingRing: {
      width: 96,
      height: 96,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.06)",
      border: "2px solid rgba(255,255,255,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      marginBottom: 14,
    },
    ringNum: {
      fontSize: 46,
      fontWeight: 900,
      letterSpacing: "-0.06em",
      lineHeight: 1,
      position: "relative",
      zIndex: 1,
    },
    countdownText: {
      fontSize: 14,
      fontWeight: 600,
      opacity: 0.85,
      letterSpacing: "0.04em",
    },
    breatheGuide: {
      fontSize: 12,
      color: "#A79E93",
      marginTop: 6,
      letterSpacing: "0.02em",
    },
    statusRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 8,
    },
    statusPrimary: {
      flex: 1,
      minWidth: 130,
      padding: "14px 16px",
      borderRadius: 16,
      border: "none",
      background: "#F3ECE3",
      color: "#12110F",
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: 15,
    },
    statusSecondary: {
      flex: 1,
      minWidth: 130,
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #3A3530",
      background: "transparent",
      color: "#F3ECE3",
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: 15,
    },
    resultBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginTop: 12,
      marginBottom: 14,
    },
    resultMove: {
      fontSize: 21,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
      letterSpacing: "-0.03em",
    },
    resultMeta: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
    },
    feedbackBox: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
    },
    feedbackText: {
      fontSize: 20,
      lineHeight: 1.35,
      fontWeight: 500,
      letterSpacing: "-0.03em",
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
    },
    statusBadgeDone: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: "#23201D",
      color: "#FFFDF9",
    },
    statusBadgeNot: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: "#ECE7DE",
      color: "#6F6861",
    },
    shareBox: {
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
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
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
    },
    historyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 9,
      flexWrap: "wrap",
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
      textAlign: "center",
      padding: "32px 16px",
      color: "#6F6861",
      fontSize: 14,
      lineHeight: 1.6,
    },
    footer: {
      textAlign: "center",
      fontSize: 12,
      color: "#736C64",
      marginTop: 10,
    },
    error: {
      color: "#8B1E1E",
      background: "#F8E7E7",
      border: "1px solid #E7BABA",
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      lineHeight: 1.4,
      marginBottom: 12,
    },
    // ── Modals ─────────────────────────────────────────────────────────────
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(18, 17, 15, 0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      zIndex: 999,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      background: "#FFFDF9",
      borderRadius: 28,
      overflow: "hidden",
      border: "1px solid #DDD5CA",
      boxShadow: "0 25px 80px rgba(18, 17, 15, 0.28)",
    },
    modalCardGold: {
      width: "100%",
      maxWidth: 420,
      background: "linear-gradient(160deg, #FFF8E1 0%, #FFF3CC 100%)",
      borderRadius: 28,
      overflow: "hidden",
      border: "2px solid #E8A000",
      boxShadow: "0 25px 80px rgba(232, 160, 0, 0.3)",
    },
    modalImage: {
      height: 190,
      backgroundImage:
        "linear-gradient(rgba(245,241,234,0.12), rgba(245,241,234,0.55)), url('/garden.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    modalImageGold: {
      height: 190,
      background: "linear-gradient(135deg, #E8A000 0%, #F5C842 50%, #E8A000 100%)",
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
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
    },
    modalTitleGold: {
      fontSize: 34,
      lineHeight: 1,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
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
    summaryGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 14,
    },
    summaryBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 16,
      padding: 12,
    },
    summaryBoxGold: {
      background: "rgba(232, 160, 0, 0.1)",
      border: "1px solid rgba(232, 160, 0, 0.3)",
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
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginTop: 3,
    },
    summaryLabelGold: {
      fontSize: 11,
      color: "#9A7000",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginTop: 3,
    },
    modalDate: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 16,
      padding: 12,
      fontSize: 13,
      color: "#6F6861",
      marginBottom: 14,
    },
    ctaGold: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: "none",
      background: "#E8A000",
      color: "#FFF8E1",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      fontFamily: "inherit",
    },
  };

  function renderStepCard(step: 1 | 2 | 3, content: React.ReactNode) {
    const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
    return (
      <div style={styles.card}>
        <div style={styles.progressWrap}>
          <div style={progressBarStyle(pct)} />
        </div>
        {content}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.card}>
            <div style={styles.title}>Loading.</div>
            <div style={styles.sub}>Checking your reset record.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes goldPulse {
          0%, 100% { box-shadow: 0 14px 40px rgba(240,192,64,0.18); }
          50% { box-shadow: 0 14px 55px rgba(240,192,64,0.38); }
        }
        @keyframes goldShimmer {
          0% { opacity: 0.85; }
          50% { opacity: 1; }
          100% { opacity: 0.85; }
        }
      `}</style>

      <div style={styles.wrap}>
        <div style={styles.topRow}>
          <div style={styles.badge}>Reset</div>
          <div style={styles.date}>
            {profile?.name ? `${profile.name} · ` : ""}
            {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>

        {/* ── Tracker ── */}
        {screen !== "profile" && (
          <div style={isMilestone ? styles.trackerCardMilestone : styles.trackerCard}>
            <div style={styles.trackerTop}>
              <div>
                <div style={styles.label}>Momentum</div>
                <div style={styles.trackerText}>
                  {doneCount} time{doneCount !== 1 ? "s" : ""} you actually moved.
                </div>
              </div>

              {streakAtRisk && !hasResetToday ? (
                <div style={styles.streakAtRiskPill}>⚠ Streak at risk</div>
              ) : isMilestone ? (
                <div style={styles.streakPillMilestone}>★ {streak} day streak</div>
              ) : streak > 1 ? (
                <div style={styles.streakPill}>{streak} day streak</div>
              ) : (
                <div style={styles.trackerText}>Last 7 days</div>
              )}
            </div>

            <div style={styles.trackerRow}>
              {trackerDays.map((day, idx) => (
                <div key={`${day.label}-${idx}`} style={styles.trackerDay}>
                  <div
                    style={{
                      ...styles.dot,
                      ...(day.active ? styles.dotActive : {}),
                      ...(day.isToday ? styles.dotToday : {}),
                    }}
                  />
                  {day.label}
                </div>
              ))}
            </div>

            {isMilestone && (
              <div style={styles.milestoneText}>{milestoneLabel}</div>
            )}
          </div>
        )}

        {/* ── Streak at risk banner ── */}
        {screen === "start" && streakAtRisk && !hasResetToday && (
          <div style={styles.riskBanner}>
            <div style={styles.riskText}>
              You had a streak going. You haven't moved today. One reset keeps it alive.
            </div>
            <button style={styles.riskButton} onClick={() => setScreen("mind")}>
              Don't break it
            </button>
          </div>
        )}

        {/* ── Check-in screen ── */}
        {screen === "checkin" && checkinEntry && (
          <div style={styles.checkinCard}>
            <div style={styles.checkinBadge}>Daily Check-in</div>
            <div style={styles.title}>Yesterday you said "not yet."</div>
            <div style={styles.sub}>You said you'd do this:</div>
            <div style={styles.checkinMove}>{checkinEntry.move}</div>
            <div style={{ ...styles.sub, marginBottom: 20 }}>
              Did it happen? Or are you still carrying it?
            </div>

            <button style={styles.cta} onClick={resumeCheckin}>
              Commit to it now
            </button>
            <button style={styles.ctaMuted} onClick={() => setScreen("start")}>
              Start fresh instead
            </button>
          </div>
        )}

        {/* ── Profile ── */}
        {screen === "profile" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>Name</div>
            <div style={styles.title}>Enter your name.</div>
            <div style={styles.sub}>No username. No password. Just your reset record.</div>

            {profileError && <div style={styles.error}>{profileError}</div>}

            <input
              style={styles.input}
              placeholder="Your name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveProfile()}
            />

            <button style={{ ...styles.cta, marginTop: 18 }} onClick={saveProfile}>
              Continue
            </button>
          </div>
        )}

        {/* ── Start ── */}
        {screen === "start" && (
          <>
            <div style={styles.heroCard}>
              <div style={styles.heroOverlay}>
                <div>
                  <div style={styles.heroTitle}>You don't stay stuck.{"\n"}You move.</div>
                  <div style={styles.heroSub}>
                    Empty the noise. Name the dodge. Make one clean move.
                  </div>
                </div>

                <div style={styles.heroBottom}>
                  <button style={styles.startButton} onClick={() => setScreen("mind")}>
                    {hasResetToday ? "Reset again" : "Start Reset"}
                  </button>
                  <div style={styles.heroFoot}>This is saved to your reset record.</div>
                </div>
              </div>
            </div>

            {lastNotYet && !hasResetToday && (
              <div style={styles.unfinishedCard}>
                <div style={styles.label}>Unfinished business</div>
                <div style={styles.unfinishedMove}>{lastNotYet.move}</div>
                <div style={styles.trackerText}>
                  You said "not yet." Respectfully, the task is still staring.
                </div>
                <button style={{ ...styles.cta, marginTop: 12 }} onClick={resumeLastNotYet}>
                  Resume
                </button>
              </div>
            )}

            {/* Notification toggle */}
            <div style={styles.notifRow}>
              <div>
                <div style={styles.notifLabel}>Daily reminder at noon</div>
                <div style={styles.notifSub}>
                  {notifPermission === "denied"
                    ? "Blocked in browser settings"
                    : notifEnabled
                    ? "You'll get a nudge if you haven't moved"
                    : "Off — tap to enable"}
                </div>
              </div>
              <div
                style={styles.toggleTrack(notifEnabled)}
                onClick={notifPermission !== "denied" ? toggleNotifications : undefined}
                role="switch"
                aria-checked={notifEnabled}
              >
                <div style={styles.toggleThumb(notifEnabled)} />
              </div>
            </div>

            <button style={styles.ctaMuted} onClick={() => setScreen("history")}>
              View history
            </button>

            <button style={styles.ctaMuted} onClick={changeName}>
              Change name
            </button>
          </>
        )}

        {/* ── Mind ── */}
        {screen === "mind" &&
          renderStepCard(
            1,
            <>
              <div style={styles.stepPill}>Step 1 / 3</div>
              <div style={styles.title}>What's actually in your head?</div>
              <div style={styles.sub}>Not everything. Just the loudest thing.</div>
              <div style={styles.focusHint}>If you over-explain, you're avoiding.</div>

              <div style={styles.chips}>
                {MIND_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{ ...styles.chip, ...(mind === opt ? styles.chipActive : {}) }}
                    onClick={() => setMind(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <input
                ref={mindRef}
                style={styles.input}
                placeholder="Say it directly."
                value={mind}
                maxLength={120}
                onChange={(e) => setMind(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && mind.trim() && setScreen("avoid")}
              />

              <div style={styles.helperRow}>
                <div style={styles.helper}>Short. Clear.</div>
                <div style={styles.charCount}>{mind.length}/120</div>
              </div>

              <button
                style={{ ...styles.cta, ...(mind.trim() ? {} : styles.ctaDisabled) }}
                disabled={!mind.trim()}
                onClick={() => setScreen("avoid")}
              >
                That's it. Continue.
              </button>

              <button style={styles.ctaMuted} onClick={resetFlow}>
                Cancel
              </button>
            </>
          )}

        {/* ── Avoid ── */}
        {screen === "avoid" &&
          renderStepCard(
            2,
            <>
              <div style={styles.stepPill}>Step 2 / 3</div>
              <div style={styles.title}>What are you avoiding?</div>
              <div style={styles.sub}>Not the story. The thing itself.</div>
              <div style={styles.focusHint}>If you soften it, you'll keep avoiding it.</div>

              <div style={styles.chips}>
                {AVOIDING_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{ ...styles.chip, ...(avoiding === opt ? styles.chipActive : {}) }}
                    onClick={() => setAvoiding(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <input
                ref={avoidRef}
                style={styles.input}
                placeholder="Be honest."
                value={avoiding}
                maxLength={120}
                onChange={(e) => setAvoiding(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && avoiding.trim() && setScreen("move")}
              />

              <div style={styles.helperRow}>
                <div style={styles.helper}>No polishing.</div>
                <div style={styles.charCount}>{avoiding.length}/120</div>
              </div>

              <button
                style={{ ...styles.cta, ...(avoiding.trim() ? {} : styles.ctaDisabled) }}
                disabled={!avoiding.trim()}
                onClick={() => setScreen("move")}
              >
                Say it. Continue.
              </button>

              <button style={styles.ctaMuted} onClick={() => setScreen("mind")}>
                Back
              </button>
            </>
          )}

        {/* ── Move ── */}
        {screen === "move" &&
          renderStepCard(
            3,
            <>
              <div style={styles.stepPill}>Step 3 / 3</div>
              <div style={styles.title}>What's the smallest move?</div>
              <div style={styles.sub}>Not the plan. Just the first step.</div>
              <div style={styles.focusHint}>If it feels big, you won't do it.</div>

              <div style={styles.chips}>
                {MOVE_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{ ...styles.chip, ...(move === opt ? styles.chipActive : {}) }}
                    onClick={() => setMove(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <input
                ref={moveRef}
                style={styles.input}
                placeholder="Make it almost too easy."
                value={move}
                maxLength={120}
                onChange={(e) => setMove(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && move.trim() && beginCommit()}
              />

              <div style={styles.helperRow}>
                <div style={styles.helper}>Visible. Immediate.</div>
                <div style={styles.charCount}>{move.length}/120</div>
              </div>

              <button
                style={{ ...styles.cta, ...(move.trim() ? {} : styles.ctaDisabled) }}
                disabled={!move.trim()}
                onClick={beginCommit}
              >
                Commit
              </button>

              <button style={styles.ctaMuted} onClick={() => setScreen("avoid")}>
                Back
              </button>
            </>
          )}

        {/* ── Commit ── */}
        {screen === "commit" && (
          <div style={{ ...styles.card, ...styles.commitCard }}>
            <div style={{ ...styles.stepPill, ...styles.stepPillDark }}>No more thinking.</div>

            <div style={styles.title}>Do this now.</div>
            <div style={{ ...styles.sub, ...styles.subDark }}>Start before you feel ready.</div>

            <div style={styles.moveBox}>
              <div style={{ ...styles.label, color: "#A79E93", marginBottom: 8 }}>Your move</div>
              <div style={styles.moveBig}>{move}</div>
            </div>

            <div style={styles.breathingWrap}>
              <div style={styles.breatheLabel}>
                {breathePhase === "in" ? "Breathe in" : "Breathe out"}
              </div>

              <div style={styles.breathingRing}>
                <div
                  style={{
                    position: "absolute",
                    inset: -5,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.2)",
                    opacity: countdown % 2 === 0 ? 0.6 : 0.15,
                    transform: countdown % 2 === 0 ? "scale(1.1)" : "scale(1.22)",
                    transition: "opacity 0.9s, transform 0.9s",
                  }}
                />
                <div style={styles.ringNum}>{countdown > 0 ? countdown : ""}</div>
              </div>

              <div style={styles.countdownText}>Just start.</div>
              <div style={styles.breatheGuide}>
                {breathePhase === "in" ? "Breathe in slowly..." : "Now breathe out..."}
              </div>
            </div>

            {countdown <= 0 && (
              <div style={styles.statusRow}>
                <button style={styles.statusPrimary} onClick={() => saveResult("done")}>
                  I did it
                </button>
                <button style={styles.statusSecondary} onClick={() => saveResult("not_yet")}>
                  I didn't
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Result ── */}
        {screen === "result" && latestEntry && (
          <div style={styles.card}>
            <div style={styles.stepPill}>Feedback</div>
            <div style={styles.title}>
              {latestEntry.status === "done" ? "You moved." : "You're still avoiding."}
            </div>

            <div style={styles.feedbackBox}>
              <div style={styles.feedbackText}>{latestEntry.feedback}</div>
            </div>

            <div style={styles.resultBox}>
              <div style={styles.label}>Your move</div>
              <div style={styles.resultMove}>{latestEntry.move}</div>
              <div style={styles.resultMeta}>
                Avoiding: {latestEntry.avoiding} · {formatDate(latestEntry.createdAt)}
              </div>
            </div>

            {latestEntry.status === "done" && streak > 0 && (
              <div
                style={{
                  ...styles.resultBox,
                  background: streak >= 7 ? "#FFF8E1" : "#F7F3EC",
                  border: streak >= 7 ? "1px solid #F0C040" : "1px solid #DDD5CA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={styles.label}>Current streak</div>
                  <div
                    style={{
                      ...styles.unfinishedMove,
                      marginBottom: 0,
                      color: streak >= 7 ? "#7A5200" : "#161413",
                    }}
                  >
                    {streak} day{streak !== 1 ? "s" : ""}
                  </div>
                </div>
                {streak >= 7 && <div style={{ fontSize: 28 }}>★</div>}
              </div>
            )}

            <div style={styles.shareBox}>
              <div style={styles.shareTitle}>Accountability</div>
              <div style={styles.shareText}>
                Send it to one person. Make it harder to disappear.
              </div>
              <button style={styles.cta} onClick={shareMove}>
                {shareCopied ? "Copied" : "Share my move"}
              </button>
            </div>

            <button style={styles.ctaMuted} onClick={() => setScreen("history")}>
              View history
            </button>

            <button style={styles.ctaMuted} onClick={resetFlow}>
              Reset again
            </button>
          </div>
        )}

        {/* ── History ── */}
        {screen === "history" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>History</div>
            <div style={styles.title}>Here's what happened.</div>
            <div style={styles.sub}>No story. Just the pattern.</div>

            {/* Summary stats */}
            {entries.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[
                  { num: totalResets, label: "Total" },
                  { num: doneCount, label: "Done" },
                  { num: streak, label: "Streak" },
                ].map(({ num, label }) => (
                  <div key={label} style={styles.summaryBox}>
                    <div style={styles.summaryNum}>{num}</div>
                    <div style={styles.summaryLabel}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.historyList}>
              {entries.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>◯</div>
                  No resets yet.
                  <br />
                  Start one to build your record.
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} style={styles.historyCard}>
                    <div style={styles.historyTop}>
                      <div style={styles.historyDate}>{formatDate(entry.createdAt)}</div>
                      <span
                        style={
                          entry.status === "done"
                            ? styles.statusBadgeDone
                            : styles.statusBadgeNot
                        }
                      >
                        {entry.status === "done" ? "Done" : "Not yet"}
                      </span>
                    </div>

                    <div style={styles.historyLine}>
                      <span style={styles.historyLineLabel}>Mind </span>
                      {entry.mind}
                    </div>
                    <div style={styles.historyLine}>
                      <span style={styles.historyLineLabel}>Avoiding </span>
                      {entry.avoiding}
                    </div>
                    <div style={styles.historyLine}>
                      <span style={styles.historyLineLabel}>Move </span>
                      {entry.move}
                    </div>
                    <div style={{ ...styles.historyLine, marginBottom: 0 }}>
                      <span style={styles.historyLineLabel}>Feedback </span>
                      {entry.feedback}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button style={{ ...styles.ctaMuted, marginTop: 16 }} onClick={resetFlow}>
              Back home
            </button>
          </div>
        )}

        {/* ── Regular result popup ── */}
        {showResultPopup && latestEntry && !showMilestone && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modalCard}>
              <div style={styles.modalImage} />
              <div style={styles.modalBody}>
                <div style={styles.modalTitle}>
                  {latestEntry.status === "done"
                    ? "Bravo. You did it."
                    : "Not yet. Still counted."}
                </div>

                <div style={styles.modalText}>
                  {latestEntry.status === "done"
                    ? "That was a real reset. Small move, real evidence. This is exactly what the app is built for."
                    : "You did not complete it yet, but now the pattern is visible. Shrink the move and try again."}
                </div>

                <div style={styles.summaryGrid}>
                  {[
                    { num: totalResets, label: "Total resets" },
                    { num: doneCount, label: "Completed" },
                    { num: notYetCount, label: "Not yet" },
                    { num: streak, label: "Day streak" },
                  ].map(({ num, label }) => (
                    <div key={label} style={styles.summaryBox}>
                      <div style={styles.summaryNum}>{num}</div>
                      <div style={styles.summaryLabel}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={styles.modalDate}>Latest reset: {latestResetTime}</div>

                <button style={styles.cta} onClick={() => setShowResultPopup(false)}>
                  See my result
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Milestone popup (gold) ── */}
        {showMilestone && latestEntry && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modalCardGold}>
              <div style={styles.modalImageGold}>★</div>
              <div style={styles.modalBody}>
                <div style={styles.modalTitleGold}>
                  {streak} days. Remarkable.
                </div>

                <div style={styles.modalTextGold}>
                  {getMilestoneLabel(streak)}
                </div>

                <div style={styles.summaryGrid}>
                  {[
                    { num: streak, label: "Day streak" },
                    { num: doneCount, label: "Completed" },
                    { num: totalResets, label: "Total resets" },
                    { num: notYetCount, label: "Not yet" },
                  ].map(({ num, label }) => (
                    <div key={label} style={styles.summaryBoxGold}>
                      <div style={styles.summaryNumGold}>{num}</div>
                      <div style={styles.summaryLabelGold}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ ...styles.modalDate, background: "rgba(232,160,0,0.1)", border: "1px solid rgba(232,160,0,0.3)", color: "#8B6300" }}>
                  Latest reset: {latestResetTime}
                </div>

                <button style={styles.ctaGold} onClick={() => setShowMilestone(false)}>
                  Keep going
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          For when your head is full and you still need to move.
        </div>
      </div>
    </div>
  );
}

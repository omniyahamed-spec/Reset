import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";

type Screen =
  | "auth"
  | "profile"
  | "start"
  | "mind"
  | "avoid"
  | "move"
  | "commit"
  | "result"
  | "history";

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
  age: number | null;
  country: string | null;
}

const MIND_SUGGESTIONS = ["Too much in my head", "I feel off", "I keep circling this"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

const COMMIT_SECONDS = 5;

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
    `Not yet. Fine. But let’s not call it confusion. The move is probably too big or your excuse has better branding.`,
    `Still parked. Make the move smaller. If it feels embarrassing, perfect — that means it might actually happen.`,
    `You didn’t do it. No tragedy. Just data. The task needs to be cut in half before your brain starts negotiating again.`,
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

  const specific =
    avoidanceLines[cleanAvoiding]?.[seed % avoidanceLines[cleanAvoiding].length];

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

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authError, setAuthError] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileAge, setProfileAge] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profileError, setProfileError] = useState("");

  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [countdown, setCountdown] = useState(COMMIT_SECONDS);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [breathePhase, setBreathePhase] = useState<"in" | "out">("in");

  const mindRef = useRef<HTMLInputElement>(null);
  const avoidRef = useRef<HTMLInputElement>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user ?? null;

      setUser(currentUser);

      if (!currentUser) {
        setScreen("auth");
        setLoading(false);
        return;
      }

      await loadProfileAndEntries(currentUser.id);
      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setEntries([]);
        setScreen("auth");
        return;
      }

      await loadProfileAndEntries(nextUser.id);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfileAndEntries(userId: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profileData) {
      setProfile(null);
      setScreen("profile");
      return;
    }

    setProfile(profileData as Profile);
    setProfileName(profileData.name ?? "");
    setProfileAge(profileData.age ? String(profileData.age) : "");
    setProfileCountry(profileData.country ?? "");

    const { data: entryData, error } = await supabase
      .from("entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Failed to load entries", error);
      setEntries([]);
    } else {
      setEntries((entryData ?? []).map(mapEntry));
    }

    setScreen("start");
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

  const lastNotYet = useMemo(
    () => entries.find((e) => e.status === "not_yet"),
    [entries]
  );

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 30; i++) {
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
    const days: { label: string; active: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const active = entries.some(
        (e) =>
          e.status === "done" &&
          startOfDay(new Date(e.createdAt)).getTime() === startOfDay(day).getTime()
      );
      days.push({ label, active });
    }
    return days;
  }, [entries]);

  async function handleAuth() {
    setAuthError("");

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.user) {
        setUser(data.user);
        setScreen("profile");
      } else {
        setAuthError("Check your email to confirm your account, then log in.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.user) {
        setUser(data.user);
        await loadProfileAndEntries(data.user.id);
      }
    }
  }

  async function saveProfile() {
    setProfileError("");

    if (!user) {
      setProfileError("You need to log in first.");
      return;
    }

    if (!profileName.trim()) {
      setProfileError("Name is required.");
      return;
    }

    const ageNumber = profileAge.trim() ? Number(profileAge) : null;

    if (ageNumber !== null && (!Number.isFinite(ageNumber) || ageNumber < 13 || ageNumber > 120)) {
      setProfileError("Enter a valid age.");
      return;
    }

    const payload = {
      id: user.id,
      name: profileName.trim(),
      age: ageNumber,
      country: profileCountry.trim() || null,
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload)
      .select()
      .single();

    if (error) {
      setProfileError(error.message);
      return;
    }

    setProfile(data as Profile);
    setScreen("start");
  }

  async function signOut() {
    await supabase.auth.signOut();
    resetFlow();
    setUser(null);
    setProfile(null);
    setEntries([]);
    setScreen("auth");
  }

  function resetFlow() {
    setMind("");
    setAvoiding("");
    setMove("");
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setLatestId(null);
    setShareCopied(false);
    setScreen(user ? "start" : "auth");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
  }

  async function saveResult(status: EntryStatus) {
    if (!user) {
      setScreen("auth");
      return;
    }

    const seed = Date.now();
    const feedback = generateFeedback(status, mind, avoiding, move, seed);

    const payload = {
      user_id: user.id,
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
      console.error("Failed to save entry", error);
      alert("The entry did not save. Check Supabase policies.");
      return;
    }

    const newEntry = mapEntry(data);
    setEntries((prev) => [newEntry, ...prev].slice(0, 30));
    setLatestId(newEntry.id);
    setScreen("result");
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

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#F5F1EA",
      color: "#161413",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "20px 14px 48px",
      boxSizing: "border-box",
    } as CSSProperties,
    wrap: {
      maxWidth: 560,
      margin: "0 auto",
    } as CSSProperties,
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    } as CSSProperties,
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
    } as CSSProperties,
    date: {
      fontSize: 12,
      color: "#6F6861",
    } as CSSProperties,
    trackerCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(35, 32, 29, 0.05)",
    } as CSSProperties,
    trackerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      flexWrap: "wrap",
    } as CSSProperties,
    label: {
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#6F6861",
      fontWeight: 700,
      marginBottom: 6,
    } as CSSProperties,
    trackerText: {
      fontSize: 13,
      color: "#6F6861",
    } as CSSProperties,
    streakPill: {
      display: "inline-block",
      background: "#23201D",
      color: "#FFFDF9",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 700,
    } as CSSProperties,
    trackerRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
    } as CSSProperties,
    trackerDay: {
      textAlign: "center",
      fontSize: 10,
      color: "#6F6861",
    } as CSSProperties,
    dot: {
      width: 11,
      height: 11,
      borderRadius: 999,
      background: "#DDD5CA",
      margin: "0 auto 6px",
    } as CSSProperties,
    dotActive: {
      background: "#23201D",
    } as CSSProperties,
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
    } as CSSProperties,
    heroOverlay: {
      width: "100%",
      padding: 28,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    } as CSSProperties,
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
    } as CSSProperties,
    heroSub: {
      fontSize: 15,
      lineHeight: 1.55,
      color: "#2B2723",
      maxWidth: 260,
    } as CSSProperties,
    heroBottom: {
      maxWidth: 320,
    } as CSSProperties,
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
    } as CSSProperties,
    heroFoot: {
      fontSize: 13,
      color: "#2B2723",
      textAlign: "center",
    } as CSSProperties,
    unfinishedCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
    } as CSSProperties,
    unfinishedMove: {
      fontSize: 20,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 10,
    } as CSSProperties,
    card: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 24,
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
    } as CSSProperties,
    commitCard: {
      background: "#12110F",
      color: "#F3ECE3",
      border: "1px solid #2A2724",
      boxShadow: "0 18px 50px rgba(18, 17, 15, 0.22)",
    } as CSSProperties,
    progressWrap: {
      height: 3,
      background: "#EDE7DE",
      borderRadius: 999,
      marginBottom: 20,
      overflow: "hidden",
    } as CSSProperties,
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
    } as CSSProperties,
    stepPillDark: {
      background: "rgba(255,255,255,0.08)",
      color: "#A79E93",
    } as CSSProperties,
    title: {
      fontSize: "clamp(28px, 6vw, 38px)",
      lineHeight: 0.98,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
    } as CSSProperties,
    sub: {
      fontSize: 14,
      color: "#6F6861",
      lineHeight: 1.55,
      marginBottom: 14,
      maxWidth: 420,
    } as CSSProperties,
    subDark: {
      color: "#A79E93",
    } as CSSProperties,
    focusHint: {
      fontSize: 12,
      color: "#6F6861",
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 10,
      padding: "8px 12px",
      marginBottom: 14,
      lineHeight: 1.5,
    } as CSSProperties,
    chips: {
      display: "flex",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 10,
    } as CSSProperties,
    chip: {
      padding: "9px 13px",
      borderRadius: 999,
      border: "1px solid #DDD5CA",
      background: "#F7F3EC",
      color: "#23201D",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    } as CSSProperties,
    chipActive: {
      background: "#23201D",
      color: "#FFFDF9",
      border: "1px solid #23201D",
    } as CSSProperties,
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
    } as CSSProperties,
    charCount: {
      fontSize: 11,
      color: "#B5ADA6",
      textAlign: "right",
    } as CSSProperties,
    helperRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      marginBottom: 16,
    } as CSSProperties,
    helper: {
      fontSize: 12,
      color: "#736C64",
    } as CSSProperties,
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
    } as CSSProperties,
    ctaDisabled: {
      opacity: 0.38,
      cursor: "not-allowed",
    } as CSSProperties,
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
    } as CSSProperties,
    moveBox: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
    } as CSSProperties,
    moveBig: {
      fontSize: 26,
      lineHeight: 1.15,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      letterSpacing: "-0.04em",
    } as CSSProperties,
    breathingWrap: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 0 20px",
    } as CSSProperties,
    breatheLabel: {
      fontSize: 11,
      color: "#A79E93",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 10,
    } as CSSProperties,
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
    } as CSSProperties,
    ringNum: {
      fontSize: 46,
      fontWeight: 900,
      letterSpacing: "-0.06em",
      lineHeight: 1,
      position: "relative",
      zIndex: 1,
    } as CSSProperties,
    countdownText: {
      fontSize: 14,
      fontWeight: 600,
      opacity: 0.85,
      letterSpacing: "0.04em",
    } as CSSProperties,
    breatheGuide: {
      fontSize: 12,
      color: "#A79E93",
      marginTop: 6,
      letterSpacing: "0.02em",
    } as CSSProperties,
    statusRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 8,
    } as CSSProperties,
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
    } as CSSProperties,
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
    } as CSSProperties,
    resultBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginTop: 12,
      marginBottom: 14,
    } as CSSProperties,
    resultMove: {
      fontSize: 21,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
      letterSpacing: "-0.03em",
    } as CSSProperties,
    resultMeta: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
    } as CSSProperties,
    feedbackBox: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
    } as CSSProperties,
    feedbackText: {
      fontSize: 20,
      lineHeight: 1.35,
      fontWeight: 500,
      letterSpacing: "-0.03em",
      fontFamily: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
    } as CSSProperties,
    statusBadgeDone: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: "#23201D",
      color: "#FFFDF9",
    } as CSSProperties,
    statusBadgeNot: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: "#ECE7DE",
      color: "#6F6861",
    } as CSSProperties,
    shareBox: {
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
    } as CSSProperties,
    shareTitle: {
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 5,
    } as CSSProperties,
    shareText: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 11,
    } as CSSProperties,
    historyList: {
      display: "grid",
      gap: 10,
    } as CSSProperties,
    historyCard: {
      padding: 14,
      borderRadius: 16,
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
    } as CSSProperties,
    historyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 9,
      flexWrap: "wrap",
    } as CSSProperties,
    historyDate: {
      fontSize: 12,
      color: "#6F6861",
    } as CSSProperties,
    historyLine: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "#161413",
      marginBottom: 5,
    } as CSSProperties,
    historyLineLabel: {
      fontWeight: 700,
      color: "#6F6861",
    } as CSSProperties,
    emptyState: {
      textAlign: "center",
      padding: "32px 16px",
      color: "#6F6861",
      fontSize: 14,
      lineHeight: 1.6,
    } as CSSProperties,
    footer: {
      textAlign: "center",
      fontSize: 12,
      color: "#736C64",
      marginTop: 10,
    } as CSSProperties,
    error: {
      color: "#8B1E1E",
      background: "#F8E7E7",
      border: "1px solid #E7BABA",
      borderRadius: 12,
      padding: "10px 12px",
      fontSize: 13,
      lineHeight: 1.4,
      marginBottom: 12,
    } as CSSProperties,
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
            <div style={styles.sub}>Checking your session.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.topRow}>
          <div style={styles.badge}>Reset</div>
          <div style={styles.date}>
            {profile?.name ? `${profile.name} · ` : ""}
            {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>

        {screen !== "auth" && screen !== "profile" && (
          <div style={styles.trackerCard}>
            <div style={styles.trackerTop}>
              <div>
                <div style={styles.label}>Momentum</div>
                <div style={styles.trackerText}>
                  {doneCount} time{doneCount !== 1 ? "s" : ""} you actually moved.
                </div>
              </div>
              {streak > 1 ? (
                <div style={styles.streakPill}>{streak} day streak</div>
              ) : (
                <div style={styles.trackerText}>Last 7 days</div>
              )}
            </div>

            <div style={styles.trackerRow}>
              {trackerDays.map((day, idx) => (
                <div key={`${day.label}-${idx}`} style={styles.trackerDay}>
                  <div style={{ ...styles.dot, ...(day.active ? styles.dotActive : {}) }} />
                  {day.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "auth" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>{authMode === "signup" ? "Create account" : "Log in"}</div>
            <div style={styles.title}>Your reset needs a home.</div>
            <div style={styles.sub}>
              Create an account so your answers save in the database, not only on your phone.
            </div>

            {authError && <div style={styles.error}>{authError}</div>}

            <input
              style={styles.input}
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />

            <input
              style={{ ...styles.input, marginTop: 10 }}
              placeholder="Password, minimum 6 characters"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />

            <div style={styles.focusHint}>
              By continuing, you agree that your profile information and reset entries will be stored
              to support your app experience.
            </div>

            <button style={styles.cta} onClick={handleAuth}>
              {authMode === "signup" ? "Sign up" : "Log in"}
            </button>

            <button
              style={styles.ctaMuted}
              onClick={() => {
                setAuthError("");
                setAuthMode(authMode === "signup" ? "login" : "signup");
              }}
            >
              {authMode === "signup"
                ? "Already have an account? Log in"
                : "New here? Create account"}
            </button>
          </div>
        )}

        {screen === "profile" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>Profile</div>
            <div style={styles.title}>Tell us who is resetting.</div>
            <div style={styles.sub}>For now: name, age, and country of residence.</div>

            {profileError && <div style={styles.error}>{profileError}</div>}

            <input
              style={styles.input}
              placeholder="Name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />

            <input
              style={{ ...styles.input, marginTop: 10 }}
              placeholder="Age"
              type="number"
              value={profileAge}
              onChange={(e) => setProfileAge(e.target.value)}
            />

            <input
              style={{ ...styles.input, marginTop: 10 }}
              placeholder="Country of residence"
              value={profileCountry}
              onChange={(e) => setProfileCountry(e.target.value)}
            />

            <button style={{ ...styles.cta, marginTop: 18 }} onClick={saveProfile}>
              Save profile
            </button>

            <button style={styles.ctaMuted} onClick={signOut}>
              Log out
            </button>
          </div>
        )}

        {screen === "start" && (
          <>
            <div style={styles.heroCard}>
              <div style={styles.heroOverlay}>
                <div>
                  <div style={styles.heroTitle}>You don’t stay stuck.{"\n"}You move.</div>
                  <div style={styles.heroSub}>
                    Empty the noise. Name the dodge. Make one clean move.
                  </div>
                </div>

                <div style={styles.heroBottom}>
                  <button style={styles.startButton} onClick={() => setScreen("mind")}>
                    Start Reset
                  </button>
                  <div style={styles.heroFoot}>This is saved to your reset record.</div>
                </div>
              </div>
            </div>

            {lastNotYet && (
              <div style={styles.unfinishedCard}>
                <div style={styles.label}>Unfinished business</div>
                <div style={styles.unfinishedMove}>{lastNotYet.move}</div>
                <div style={styles.trackerText}>
                  You said “not yet.” Respectfully, the task is still staring.
                </div>
                <button style={{ ...styles.cta, marginTop: 12 }} onClick={resumeLastNotYet}>
                  Resume
                </button>
              </div>
            )}

            <button style={styles.ctaMuted} onClick={() => setScreen("history")}>
              View history
            </button>

            <button style={styles.ctaMuted} onClick={() => setScreen("profile")}>
              Edit profile
            </button>

            <button style={styles.ctaMuted} onClick={signOut}>
              Log out
            </button>
          </>
        )}

        {screen === "mind" &&
          renderStepCard(
            1,
            <>
              <div style={styles.stepPill}>Step 1 / 3</div>
              <div style={styles.title}>What’s actually in your head?</div>
              <div style={styles.sub}>Not everything. Just the loudest thing.</div>
              <div style={styles.focusHint}>If you over-explain, you’re avoiding.</div>

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
                That’s it. Continue.
              </button>

              <button style={styles.ctaMuted} onClick={resetFlow}>
                Cancel
              </button>
            </>
          )}

        {screen === "avoid" &&
          renderStepCard(
            2,
            <>
              <div style={styles.stepPill}>Step 2 / 3</div>
              <div style={styles.title}>What are you avoiding?</div>
              <div style={styles.sub}>Not the story. The thing itself.</div>
              <div style={styles.focusHint}>If you soften it, you’ll keep avoiding it.</div>

              <div style={styles.chips}>
                {AVOIDING_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    style={{
                      ...styles.chip,
                      ...(avoiding === opt ? styles.chipActive : {}),
                    }}
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

        {screen === "move" &&
          renderStepCard(
            3,
            <>
              <div style={styles.stepPill}>Step 3 / 3</div>
              <div style={styles.title}>What’s the smallest move?</div>
              <div style={styles.sub}>Not the plan. Just the first step.</div>
              <div style={styles.focusHint}>If it feels big, you won’t do it.</div>

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

        {screen === "commit" && (
          <div style={{ ...styles.card, ...styles.commitCard }}>
            <div style={{ ...styles.stepPill, ...styles.stepPillDark }}>
              No more thinking.
            </div>

            <div style={styles.title}>Do this now.</div>
            <div style={{ ...styles.sub, ...styles.subDark }}>
              Start before you feel ready.
            </div>

            <div style={styles.moveBox}>
              <div style={{ ...styles.label, color: "#A79E93", marginBottom: 8 }}>
                Your move
              </div>
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
                  I didn’t
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && latestEntry && (
          <div style={styles.card}>
            <div style={styles.stepPill}>Feedback</div>
            <div style={styles.title}>
              {latestEntry.status === "done" ? "You moved." : "You’re still avoiding."}
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

        {screen === "history" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>History</div>
            <div style={styles.title}>Here’s what happened.</div>
            <div style={styles.sub}>No story. Just the pattern.</div>

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

        <div style={styles.footer}>For when your head is full and you still need to move.</div>
      </div>
    </div>
  );
}

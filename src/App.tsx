import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";

type Screen = "start" | "mind" | "avoid" | "move" | "commit" | "result" | "history";
type EntryStatus = "done" | "not_yet";

interface Entry {
  id: number;
  createdAt: string;
  mind: string;
  avoiding: string;
  move: string;
  status: EntryStatus;
}

const STORAGE_KEY = "reset_app_v9_entries";

const MIND_SUGGESTIONS = ["Too much in my head", "I feel off", "I keep circling this"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

// Countdown shortened to 5 — enough to pause without losing the window
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

function getResultLine(status: EntryStatus, seed: number): string {
  const yes = ["Good.", "That counts.", "You moved.", "Keep going."];
  const no = ["Then make it smaller.", "Still avoiding?", "Cut it in half.", "Try again."];
  const source = status === "done" ? yes : no;
  return source[seed % source.length];
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [countdown, setCountdown] = useState(COMMIT_SECONDS);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [breathePhase, setBreathePhase] = useState<"in" | "out">("in");

  // Auto-focus inputs on each step
  const mindRef = useRef<HTMLInputElement>(null);
  const avoidRef = useRef<HTMLInputElement>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as Entry[]);
    } catch (error) {
      console.error("Failed to load entries", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error("Failed to save entries", error);
    }
  }, [entries]);

  // Auto-focus the active input when screen changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (screen === "mind") mindRef.current?.focus();
      if (screen === "avoid") avoidRef.current?.focus();
      if (screen === "move") moveRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [screen]);

  // Countdown + breathing phase toggle
  useEffect(() => {
    if (screen !== "commit" || countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        // Toggle breathing phase every 2 ticks
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

  const doneCount = useMemo(
    () => entries.filter((e) => e.status === "done").length,
    [entries]
  );

  // Streak: consecutive days with at least one "done" entry
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

  function resetFlow() {
    setMind("");
    setAvoiding("");
    setMove("");
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setLatestId(null);
    setShareCopied(false);
    setScreen("start");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(COMMIT_SECONDS);
    setBreathePhase("in");
    setScreen("commit");
  }

  function saveResult(status: EntryStatus) {
    const newEntry: Entry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      mind: mind.trim(),
      avoiding: avoiding.trim(),
      move: move.trim(),
      status,
    };
    setEntries((prev) => [newEntry, ...prev].slice(0, 30));
    setLatestId(newEntry.id);
    setScreen("result");
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

  const resultCopy = latestEntry ? getResultLine(latestEntry.status, latestEntry.id) : "";
  const today = new Date();

  // ─── Styles ──────────────────────────────────────────────────────────────────

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

    // ── Tracker ────────────────────────────────────────────────────────────────
    trackerCard: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 14px 40px rgba(35, 32, 29, 0.05)",
    },
    trackerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      flexWrap: "wrap" as const,
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

    // ── Hero (start screen) ────────────────────────────────────────────────────
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
    },
    heroSub: {
      fontSize: 15,
      lineHeight: 1.55,
      color: "#2B2723",
      maxWidth: 240,
    },
    heroBottom: {
      maxWidth: 320,
    },
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

    // ── Step cards ─────────────────────────────────────────────────────────────
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

    // Progress bar
    progressWrap: {
      height: 3,
      background: "#EDE7DE",
      borderRadius: 999,
      marginBottom: 20,
      overflow: "hidden",
    },
    progressBar: (pct: number): CSSProperties => ({
      height: "100%",
      background: "#23201D",
      borderRadius: 999,
      width: `${pct}%`,
      transition: "width 0.4s ease",
    }),

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
    subDark: {
      color: "#A79E93",
    },

    // Focus hint — contextual anchor for drifting attention
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
    focusHintDark: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#A79E93",
    },

    chips: {
      display: "flex",
      flexWrap: "wrap" as const,
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
      boxSizing: "border-box" as const,
      outline: "none",
      borderRadius: 0,
      fontFamily: "inherit",
    },
    inputDark: {
      color: "#F3ECE3",
      borderBottom: "1.5px solid #3A3530",
    },
    charCount: {
      fontSize: 11,
      color: "#B5ADA6",
      textAlign: "right" as const,
    },
    helper: {
      fontSize: 12,
      color: "#736C64",
      marginTop: 6,
      marginBottom: 16,
    },
    helperRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      marginBottom: 16,
    },
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
    ctaDark: {
      background: "#F3ECE3",
      color: "#12110F",
    },
    ctaDisabled: {
      opacity: 0.38,
      cursor: "not-allowed" as const,
    },
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
    ctaMutedDark: {
      border: "1px solid #2A2724",
      color: "#A79E93",
    },

    // ── Commit screen ──────────────────────────────────────────────────────────
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
      flexDirection: "column" as const,
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
      position: "relative" as const,
      marginBottom: 14,
    },
    ringNum: {
      fontSize: 46,
      fontWeight: 900,
      letterSpacing: "-0.06em",
      lineHeight: 1,
      position: "relative" as const,
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
      flexWrap: "wrap" as const,
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

    // ── Result screen ──────────────────────────────────────────────────────────
    resultBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginTop: 12,
      marginBottom: 14,
    },
    resultBoxTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
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
    shareTitle: {
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 5,
    },
    shareText: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 11,
    },

    // ── History screen ─────────────────────────────────────────────────────────
    historyList: {
      display: "grid",
      gap: 10,
    },
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
      flexWrap: "wrap" as const,
    },
    historyDate: {
      fontSize: 12,
      color: "#6F6861",
    },
    historyLine: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "#161413",
      marginBottom: 5,
    },
    historyLineLabel: {
      fontWeight: 700,
      color: "#6F6861",
    },
    emptyState: {
      textAlign: "center" as const,
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
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  function renderStepCard(step: 1 | 2 | 3, content: React.ReactNode) {
    const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
    return (
      <div style={styles.card}>
        <div style={styles.progressWrap}>
          <div style={styles.progressBar(pct)} />
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        {/* Top row */}
        <div style={styles.topRow}>
          <div style={styles.badge}>Reset</div>
          <div style={styles.date}>
            {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>

        {/* Tracker */}
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

        {/* ── Start ── */}
        {screen === "start" && (
          <>
            <div style={styles.heroCard}>
              <div style={styles.heroOverlay}>
                <div>
                  <div style={styles.heroTitle}>Empty your head.{"\n"}Take action.</div>
                  <div style={styles.heroSub}>Clarity comes when you stop running.</div>
                </div>
                <div style={styles.heroBottom}>
                  <button style={styles.startButton} onClick={() => setScreen("mind")}>
                    Start Reset
                  </button>
                  <div style={styles.heroFoot}>This is for you, not for anyone.</div>
                </div>
              </div>
            </div>
            <button style={styles.ctaMuted} onClick={() => setScreen("history")}>
              View history
            </button>
          </>
        )}

        {/* ── Step 1: Mind ── */}
        {screen === "mind" &&
          renderStepCard(
            1,
            <>
              <div style={styles.stepPill}>Step 1 / 3</div>
              <div style={styles.title}>What&apos;s on your mind?</div>
              <div style={styles.sub}>Say it as it is. Don&apos;t filter.</div>
              <div style={styles.focusHint}>One thought. Just the loudest one right now.</div>

              <div style={styles.chips}>
                {MIND_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
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
                placeholder="Don't filter it."
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
                Continue
              </button>
              <button style={styles.ctaMuted} onClick={resetFlow}>
                Cancel
              </button>
            </>
          )}

        {/* ── Step 2: Avoid ── */}
        {screen === "avoid" &&
          renderStepCard(
            2,
            <>
              <div style={styles.stepPill}>Step 2 / 3</div>
              <div style={styles.title}>What are you actually avoiding?</div>
              <div style={styles.sub}>The real thing. Not the excuse.</div>
              <div style={styles.focusHint}>Be honest. What keeps getting pushed off?</div>

              <div style={styles.chips}>
                {AVOIDING_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
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
                placeholder="Be honest. Not smart."
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
                Continue
              </button>
              <button style={styles.ctaMuted} onClick={() => setScreen("mind")}>
                Back
              </button>
            </>
          )}

        {/* ── Step 3: Move ── */}
        {screen === "move" &&
          renderStepCard(
            3,
            <>
              <div style={styles.stepPill}>Step 3 / 3</div>
              <div style={styles.title}>What&apos;s the next move?</div>
              <div style={styles.sub}>Not a plan. One action.</div>
              <div style={styles.focusHint}>
                Make it tiny enough that you can&apos;t say no to it.
              </div>

              <div style={styles.chips}>
                {MOVE_SUGGESTIONS.map((opt) => (
                  <button
                    key={opt}
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
                placeholder="Something small. Something real."
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

        {/* ── Commit (breathing + countdown) ── */}
        {screen === "commit" && (
          <div style={{ ...styles.card, ...styles.commitCard }}>
            <div style={{ ...styles.stepPill, ...styles.stepPillDark }}>
              Breathe. Then do it.
            </div>
            <div style={styles.title}>Do it.</div>
            <div style={{ ...styles.sub, ...styles.subDark }}>No more thinking.</div>

            <div style={styles.moveBox}>
              <div style={{ ...styles.label, color: "#A79E93", marginBottom: 8 }}>
                Your move
              </div>
              <div style={styles.moveBig}>{move}</div>
            </div>

            {/* Breathing ring */}
            <div style={styles.breathingWrap}>
              <div style={styles.breatheLabel}>
                {breathePhase === "in" ? "Breathe in" : "Breathe out"}
              </div>
              <div style={styles.breathingRing}>
                {/* Pulse ring via CSS animation — inline keyframes not supported,
                    so we use a simple border opacity trick instead */}
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
                  Yes, I did it
                </button>
                <button style={styles.statusSecondary} onClick={() => saveResult("not_yet")}>
                  Not yet
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Result ── */}
        {screen === "result" && latestEntry && (
          <div style={styles.card}>
            <div style={styles.stepPill}>Result</div>
            <div style={styles.title}>{resultCopy}</div>
            <div style={styles.sub}>
              {latestEntry.status === "done" ? "Keep it going." : "Try again. Smaller."}
            </div>

            <div style={styles.resultBox}>
              <div style={styles.resultBoxTop}>
                <div style={styles.label}>Move</div>
                <span
                  style={
                    latestEntry.status === "done"
                      ? styles.statusBadgeDone
                      : styles.statusBadgeNot
                  }
                >
                  {latestEntry.status === "done" ? "Done" : "Not yet"}
                </span>
              </div>
              <div style={styles.resultMove}>{latestEntry.move}</div>
              <div style={styles.resultMeta}>
                {latestEntry.avoiding} &middot; {formatDate(latestEntry.createdAt)}
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

        {/* ── History ── */}
        {screen === "history" && (
          <div style={styles.card}>
            <div style={styles.stepPill}>History</div>
            <div style={styles.title}>Here&apos;s what happened.</div>
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
                    <div style={{ ...styles.historyLine, marginBottom: 0 }}>
                      <span style={styles.historyLineLabel}>Move </span>
                      {entry.move}
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

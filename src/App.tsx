import React, { CSSProperties, useEffect, useMemo, useState } from "react";

type Screen = "home" | "mind" | "avoid" | "move" | "commit" | "result" | "wrap";
type EntryStatus = "done" | "not_yet";

interface Entry {
  id: number;
  createdAt: string;
  weekKey: string;
  mind: string;
  avoiding: string;
  move: string;
  status: EntryStatus;
}

const STORAGE_KEY = "reset_app_v6_entries";
const FREE_WEEKLY_LIMIT = 7;

const MIND_SUGGESTIONS = ["Too much in my head", "I feel off", "I keep circling this"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((startOfDay(d).getTime() - startOfDay(first).getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getIdentity(sparks: number): { title: string; nextTitle: string; progress: number } {
  if (sparks < 5) {
    return {
      title: "Starter",
      nextTitle: "Loop Breaker",
      progress: Math.min(100, (sparks / 5) * 100),
    };
  }
  if (sparks < 20) {
    return {
      title: "Loop Breaker",
      nextTitle: "Clarity Runner",
      progress: Math.min(100, ((sparks - 5) / 15) * 100),
    };
  }
  return {
    title: "Clarity Runner",
    nextTitle: "Reset Pro",
    progress: Math.min(100, ((sparks - 20) / 20) * 100),
  };
}

function getInsight(entries: Entry[]): string {
  if (entries.length === 0) return "Nothing clear yet.";
  const counts: Record<string, number> = {};
  entries.forEach((e) => {
    counts[e.avoiding] = (counts[e.avoiding] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return "You are still circling.";
  if (top.toLowerCase().includes("decision")) return "You avoid decisions more than work.";
  if (top.toLowerCase().includes("message")) return "It is not the task. It is the contact.";
  if (top.toLowerCase().includes("starting")) return "Your problem is the first move.";
  return `You keep coming back to: ${top}.`;
}

function getResultCopy(status: EntryStatus, indexSeed: number): string {
  const doneLines = [
    "Good.",
    "You moved. That matters.",
    "Small, but real.",
    "That was enough for now.",
  ];
  const notYetLines = [
    "Then make it smaller.",
    "You're still avoiding.",
    "Cut it in half.",
    "Try again. Smaller.",
  ];
  const source = status === "done" ? doneLines : notYetLines;
  return source[indexSeed % source.length];
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mind, setMind] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [countdown, setCountdown] = useState(8);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

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

  useEffect(() => {
    if (screen !== "commit" || countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown]);

  const currentWeekKey = getWeekKey(new Date());

  const weeklyEntries = useMemo(
    () => entries.filter((entry) => entry.weekKey === currentWeekKey),
    [entries, currentWeekKey]
  );

  const weeklyRemaining = Math.max(0, FREE_WEEKLY_LIMIT - weeklyEntries.length);
  const sparks = useMemo(
    () => entries.filter((entry) => entry.status === "done").length,
    [entries]
  );
  const identity = useMemo(() => getIdentity(sparks), [sparks]);

  const latestEntry = useMemo(
    () => entries.find((entry) => entry.id === latestId) ?? null,
    [entries, latestId]
  );

  const trackerDays = useMemo(() => {
    const days: { label: string; active: boolean; cracked: boolean }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const dayEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        return startOfDay(entryDate).getTime() === startOfDay(day).getTime();
      });
      const active = dayEntries.some((e) => e.status === "done");
      const cracked = !active && i < 2 && entries.length > 0;
      days.push({ label, active, cracked });
    }
    return days;
  }, [entries]);

  const weeklyWrapData = useMemo(() => {
    const attempted = weeklyEntries.length;
    const done = weeklyEntries.filter((e) => e.status === "done").length;
    const notYet = weeklyEntries.filter((e) => e.status === "not_yet").length;

    const avoidCounts: Record<string, number> = {};
    weeklyEntries.forEach((entry) => {
      avoidCounts[entry.avoiding] = (avoidCounts[entry.avoiding] || 0) + 1;
    });

    const mostAvoided = Object.entries(avoidCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return {
      attempted,
      done,
      notYet,
      mostAvoided,
      insight: getInsight(weeklyEntries),
    };
  }, [weeklyEntries]);

  function resetFlow() {
    setMind("");
    setAvoiding("");
    setMove("");
    setCountdown(8);
    setLatestId(null);
    setShareCopied(false);
    setScreen("home");
  }

  function beginCommit() {
    if (!mind.trim() || !avoiding.trim() || !move.trim()) return;
    setCountdown(8);
    setScreen("commit");
  }

  function saveResult(status: EntryStatus) {
    const newEntry: Entry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      weekKey: getWeekKey(new Date()),
      mind: mind.trim(),
      avoiding: avoiding.trim(),
      move: move.trim(),
      status,
    };

    setEntries((prev) => [newEntry, ...prev].slice(0, 100));
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

  const resultCopy = latestEntry ? getResultCopy(latestEntry.status, latestEntry.id) : "";

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 22%), linear-gradient(180deg, #0e0c0a 0%, #17120e 100%)",
      color: "#f6ede4",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "20px 14px 40px",
      boxSizing: "border-box",
    },
    wrap: {
      maxWidth: 560,
      margin: "0 auto",
    },
    badgeRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    badge: {
      display: "inline-block",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      color: "rgba(255,255,255,0.68)",
      borderRadius: 999,
      padding: "7px 11px",
      fontSize: 11,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
    },
    today: {
      fontSize: 12,
      color: "rgba(255,255,255,0.52)",
    },
    topCard: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 16px 50px rgba(0,0,0,0.22)",
    },
    topHead: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "wrap",
      marginBottom: 14,
    },
    label: {
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.48)",
      fontWeight: 700,
      marginBottom: 6,
    },
    identityTitle: {
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    identitySub: {
      fontSize: 13,
      color: "rgba(255,255,255,0.62)",
      marginTop: 4,
    },
    progressWrap: {
      marginTop: 10,
    },
    progressBar: {
      width: "100%",
      height: 8,
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      background: "linear-gradient(90deg, #e8824a 0%, #ffac79 100%)",
    },
    proBox: {
      minWidth: 180,
      background: "rgba(232,130,74,0.08)",
      border: "1px solid rgba(232,130,74,0.18)",
      borderRadius: 18,
      padding: 12,
    },
    proTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: "#ffb07f",
      marginBottom: 6,
    },
    proText: {
      fontSize: 12,
      color: "rgba(255,255,255,0.68)",
      lineHeight: 1.5,
    },
    trackerRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
      marginTop: 4,
    },
    trackerDay: {
      textAlign: "center",
      fontSize: 11,
      color: "rgba(255,255,255,0.5)",
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 999,
      margin: "0 auto 7px",
      background: "rgba(255,255,255,0.12)",
      position: "relative",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    },
    dotActive: {
      background: "#e8824a",
      boxShadow: "0 0 14px rgba(232,130,74,0.45)",
    },
    dotCracked: {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.18)",
    },
    mainCard: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 28,
      padding: 22,
      boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
      backdropFilter: "blur(12px)",
    },
    commitCard: {
      background: "linear-gradient(180deg, #e8824a 0%, #d66f35 100%)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#fff7f1",
    },
    stepPill: {
      display: "inline-block",
      padding: "8px 11px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.65)",
      marginBottom: 14,
    },
    title: {
      fontSize: "clamp(30px, 7vw, 42px)",
      lineHeight: 0.98,
      letterSpacing: "-0.05em",
      fontWeight: 800,
      marginBottom: 10,
    },
    sub: {
      fontSize: 15,
      color: "rgba(255,255,255,0.7)",
      lineHeight: 1.55,
      marginBottom: 18,
      maxWidth: 420,
    },
    chips: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      padding: "10px 12px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.04)",
      color: "#f6ede4",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    },
    chipActive: {
      background: "#f6ede4",
      color: "#17120e",
      border: "1px solid #f6ede4",
    },
    input: {
      width: "100%",
      padding: "14px 15px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "#f6ede4",
      fontSize: 14,
      boxSizing: "border-box",
      outline: "none",
    },
    helper: {
      fontSize: 12,
      color: "rgba(255,255,255,0.48)",
      marginTop: 8,
      marginBottom: 18,
    },
    cta: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: "none",
      background: "#f6ede4",
      color: "#17120e",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
    },
    ctaDark: {
      background: "#17120e",
      color: "#fff7f1",
    },
    ctaMuted: {
      width: "100%",
      padding: "14px 18px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "transparent",
      color: "rgba(255,255,255,0.68)",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      marginTop: 10,
    },
    moveBox: {
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 20,
      padding: 16,
      marginBottom: 18,
    },
    moveBig: {
      fontSize: 24,
      lineHeight: 1.18,
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    countdownWrap: {
      display: "grid",
      placeItems: "center",
      padding: "10px 0 18px",
    },
    countdown: {
      fontSize: "clamp(70px, 18vw, 110px)",
      lineHeight: 1,
      fontWeight: 900,
      letterSpacing: "-0.08em",
    },
    countdownText: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: 600,
      opacity: 0.88,
    },
    statusRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 8,
    },
    statusPrimary: {
      flex: 1,
      minWidth: 140,
      padding: "14px 16px",
      borderRadius: 16,
      border: "none",
      background: "#17120e",
      color: "#fff7f1",
      fontWeight: 800,
      cursor: "pointer",
    },
    statusSecondary: {
      flex: 1,
      minWidth: 140,
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "transparent",
      color: "#fff7f1",
      fontWeight: 800,
      cursor: "pointer",
    },
    resultBox: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 16,
      marginTop: 10,
      marginBottom: 16,
    },
    resultMove: {
      fontSize: 22,
      lineHeight: 1.2,
      fontWeight: 800,
      marginBottom: 8,
      letterSpacing: "-0.03em",
    },
    resultText: {
      fontSize: 14,
      color: "rgba(255,255,255,0.72)",
      lineHeight: 1.55,
    },
    shareBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    shareTitle: {
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 6,
    },
    shareText: {
      fontSize: 13,
      color: "rgba(255,255,255,0.66)",
      lineHeight: 1.5,
      marginBottom: 12,
    },
    wrapGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
      marginBottom: 16,
    },
    wrapStat: {
      padding: 14,
      borderRadius: 18,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    wrapStatBig: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    wrapInsight: {
      padding: 16,
      borderRadius: 18,
      background: "rgba(232,130,74,0.08)",
      border: "1px solid rgba(232,130,74,0.18)",
      color: "#ffd4bb",
      lineHeight: 1.55,
      marginBottom: 14,
    },
    footer: {
      textAlign: "center",
      fontSize: 12,
      color: "rgba(255,255,255,0.4)",
      marginTop: 12,
    },
  };

  const today = new Date();

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.badgeRow}>
          <div style={styles.badge}>Reset</div>
          <div style={styles.today}>
            {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>

        <div style={styles.topCard}>
          <div style={styles.topHead}>
            <div>
              <div style={styles.label}>Identity</div>
              <div style={styles.identityTitle}>{identity.title}</div>
              <div style={styles.identitySub}>
                {sparks} sparks · next: {identity.nextTitle}
              </div>

              <div style={styles.progressWrap}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${identity.progress}%` }} />
                </div>
              </div>
            </div>

            <div style={styles.proBox}>
              <div style={styles.proTitle}>Reset Pro</div>
              <div style={styles.proText}>
                {weeklyRemaining > 0
                  ? `${weeklyRemaining} free reset${weeklyRemaining === 1 ? "" : "s"} left this week`
                  : "Free weekly limit reached"}
              </div>
            </div>
          </div>

          <div style={styles.label}>Streak</div>
          <div style={styles.trackerRow}>
            {trackerDays.map((day, idx) => (
              <div key={`${day.label}-${idx}`} style={styles.trackerDay}>
                <div
                  style={{
                    ...styles.dot,
                    ...(day.active ? styles.dotActive : {}),
                    ...(day.cracked ? styles.dotCracked : {}),
                  }}
                >
                  {day.cracked ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.62)",
                      }}
                    >
                      /
                    </div>
                  ) : null}
                </div>
                {day.label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            ...styles.mainCard,
            ...(screen === "commit" ? styles.commitCard : {}),
          }}
        >
          {screen === "home" && (
            <>
              <div style={styles.stepPill}>Reset</div>
              <div style={styles.title}>You&apos;re here for a reason.</div>
              <div style={styles.sub}>Empty your head. Then move.</div>

              <button style={styles.cta} onClick={() => setScreen("mind")}>
                Start
              </button>

              <button style={styles.ctaMuted} onClick={() => setScreen("wrap")}>
                Weekly wrap
              </button>
            </>
          )}

          {screen === "mind" && (
            <>
              <div style={styles.stepPill}>Step 1 / 3</div>
              <div style={styles.title}>What&apos;s on your mind?</div>
              <div style={styles.sub}>Say it as it is.</div>

              <div style={styles.chips}>
                {MIND_SUGGESTIONS.map((option) => (
                  <button
                    key={option}
                    style={{
                      ...styles.chip,
                      ...(mind === option ? styles.chipActive : {}),
                    }}
                    onClick={() => setMind(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <input
                style={styles.input}
                placeholder="Don’t filter it."
                value={mind}
                maxLength={120}
                onChange={(e) => setMind(e.target.value)}
              />

              <div style={styles.helper}>Short. Clear.</div>

              <button
                style={{
                  ...styles.cta,
                  opacity: mind.trim() ? 1 : 0.42,
                  cursor: mind.trim() ? "pointer" : "not-allowed",
                }}
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

          {screen === "avoid" && (
            <>
              <div style={styles.stepPill}>Step 2 / 3</div>
              <div style={styles.title}>What are you actually avoiding?</div>
              <div style={styles.sub}>The real thing. Not the excuse.</div>

              <div style={styles.chips}>
                {AVOIDING_SUGGESTIONS.map((option) => (
                  <button
                    key={option}
                    style={{
                      ...styles.chip,
                      ...(avoiding === option ? styles.chipActive : {}),
                    }}
                    onClick={() => setAvoiding(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <input
                style={styles.input}
                placeholder="Be honest. Not smart."
                value={avoiding}
                maxLength={120}
                onChange={(e) => setAvoiding(e.target.value)}
              />

              <div style={styles.helper}>No polishing.</div>

              <button
                style={{
                  ...styles.cta,
                  opacity: avoiding.trim() ? 1 : 0.42,
                  cursor: avoiding.trim() ? "pointer" : "not-allowed",
                }}
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

          {screen === "move" && (
            <>
              <div style={styles.stepPill}>Step 3 / 3</div>
              <div style={styles.title}>What&apos;s the next move?</div>
              <div style={styles.sub}>Not a plan. One action.</div>

              <div style={styles.chips}>
                {MOVE_SUGGESTIONS.map((option) => (
                  <button
                    key={option}
                    style={{
                      ...styles.chip,
                      ...(move === option ? styles.chipActive : {}),
                    }}
                    onClick={() => setMove(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <input
                style={styles.input}
                placeholder="Something small. Something real."
                value={move}
                maxLength={120}
                onChange={(e) => setMove(e.target.value)}
              />

              <div style={styles.helper}>Visible. Immediate.</div>

              <button
                style={{
                  ...styles.cta,
                  opacity: move.trim() ? 1 : 0.42,
                  cursor: move.trim() ? "pointer" : "not-allowed",
                }}
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
            <>
              <div
                style={{
                  ...styles.stepPill,
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,247,241,0.78)",
                }}
              >
                Commit
              </div>

              <div style={styles.title}>Do it.</div>
              <div style={{ ...styles.sub, color: "rgba(255,247,241,0.82)" }}>
                No more thinking.
              </div>

              <div style={styles.moveBox}>
                <div style={{ ...styles.label, color: "rgba(255,247,241,0.68)" }}>Your move</div>
                <div style={styles.moveBig}>{move}</div>
              </div>

              <div style={styles.countdownWrap}>
                <div style={styles.countdown}>{countdown}</div>
                <div style={styles.countdownText}>Your streak is on the line.</div>
              </div>

              {countdown <= 0 && (
                <div style={styles.statusRow}>
                  <button style={styles.statusPrimary} onClick={() => saveResult("done")}>
                    Yes
                  </button>
                  <button style={styles.statusSecondary} onClick={() => saveResult("not_yet")}>
                    Not yet
                  </button>
                </div>
              )}
            </>
          )}

          {screen === "result" && latestEntry && (
            <>
              <div style={styles.stepPill}>Result</div>
              <div style={styles.title}>{resultCopy}</div>
              <div style={styles.sub}>
                {latestEntry.status === "done" ? "Keep it going." : "Try again. Smaller."}
              </div>

              <div style={styles.resultBox}>
                <div style={styles.label}>Move</div>
                <div style={styles.resultMove}>{latestEntry.move}</div>
                <div style={styles.resultText}>
                  {latestEntry.avoiding} · {formatFullDate(latestEntry.createdAt)}
                </div>
              </div>

              <div style={styles.shareBox}>
                <div style={styles.shareTitle}>Accountability</div>
                <div style={styles.shareText}>
                  Send it to one person. Make it harder to disappear.
                </div>

                <button style={{ ...styles.cta, ...styles.ctaDark }} onClick={shareMove}>
                  {shareCopied ? "Copied" : "Share my move"}
                </button>
              </div>

              <button style={styles.ctaMuted} onClick={resetFlow}>
                Again
              </button>
            </>
          )}

          {screen === "wrap" && (
            <>
              <div style={styles.stepPill}>Weekly wrap</div>
              <div style={styles.title}>Here&apos;s the week.</div>
              <div style={styles.sub}>No story. Just the pattern.</div>

              <div style={styles.wrapGrid}>
                <div style={styles.wrapStat}>
                  <div style={styles.label}>Tried</div>
                  <div style={styles.wrapStatBig}>{weeklyWrapData.attempted}</div>
                </div>

                <div style={styles.wrapStat}>
                  <div style={styles.label}>Done</div>
                  <div style={styles.wrapStatBig}>{weeklyWrapData.done}</div>
                </div>

                <div style={styles.wrapStat}>
                  <div style={styles.label}>Not yet</div>
                  <div style={styles.wrapStatBig}>{weeklyWrapData.notYet}</div>
                </div>

                <div style={styles.wrapStat}>
                  <div style={styles.label}>Most avoided</div>
                  <div style={{ ...styles.wrapStatBig, fontSize: 18 }}>
                    {weeklyWrapData.mostAvoided}
                  </div>
                </div>
              </div>

              <div style={styles.wrapInsight}>{weeklyWrapData.insight}</div>

              <button style={styles.cta} onClick={() => setScreen("home")}>
                Back
              </button>
            </>
          )}
        </div>

        <div style={styles.footer}>For when your head is full and you still need to move.</div>
      </div>
    </div>
  );
}

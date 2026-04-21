import React, { CSSProperties, useEffect, useMemo, useState } from "react";

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

const STORAGE_KEY = "reset_app_v8_entries";

const MIND_SUGGESTIONS = ["Too much in my head", "I feel off", "I keep circling this"];
const AVOIDING_SUGGESTIONS = ["Starting", "A message", "A decision"];
const MOVE_SUGGESTIONS = ["Send it", "Open it", "Start 2 min"];

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
  const no = ["Then make it smaller.", "You're still avoiding.", "Cut it in half.", "Try again."];
  const source = status === "done" ? yes : no;
  return source[seed % source.length];
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
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

  const latestEntry = useMemo(
    () => entries.find((entry) => entry.id === latestId) ?? null,
    [entries, latestId]
  );

  const doneCount = useMemo(
    () => entries.filter((entry) => entry.status === "done").length,
    [entries]
  );

  const trackerDays = useMemo(() => {
    const days: { label: string; active: boolean }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      const active = entries.some((entry) => {
        if (entry.status !== "done") return false;
        return startOfDay(new Date(entry.createdAt)).getTime() === startOfDay(day).getTime();
      });
      days.push({ label, active });
    }
    return days;
  }, [entries]);

  function resetFlow() {
    setMind("");
    setAvoiding("");
    setMove("");
    setCountdown(8);
    setLatestId(null);
    setShareCopied(false);
    setScreen("start");
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

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#F5F1EA",
      color: "#161413",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "20px 14px 40px",
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
    trackerRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
    },
    trackerDay: {
      textAlign: "center",
      fontSize: 11,
      color: "#6F6861",
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: "#DDD5CA",
      margin: "0 auto 7px",
    },
    dotActive: {
      background: "#23201D",
    },
    heroCard: {
      position: "relative",
      minHeight: 620,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: "#EDE7DE",
      backgroundImage:
        "linear-gradient(rgba(245,241,234,0.30), rgba(245,241,234,0.64)), url('/garden.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      border: "1px solid #DDD5CA",
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
      display: "flex",
      alignItems: "stretch",
    },
    heroOverlay: {
      width: "100%",
      padding: 28,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    heroTop: {},
    heroTitle: {
      fontSize: "clamp(44px, 10vw, 64px)",
      lineHeight: 0.95,
      letterSpacing: "-0.06em",
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      maxWidth: 340,
      color: "#161413",
      marginBottom: 18,
    },
    heroSub: {
      fontSize: 16,
      lineHeight: 1.55,
      color: "#2B2723",
      maxWidth: 260,
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
      fontFamily:
        'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      cursor: "pointer",
      marginBottom: 12,
    },
    heroFoot: {
      fontSize: 13,
      color: "#2B2723",
      textAlign: "center",
    },
    card: {
      background: "#FFFDF9",
      border: "1px solid #DDD5CA",
      borderRadius: 28,
      padding: 22,
      boxShadow: "0 18px 50px rgba(35, 32, 29, 0.06)",
    },
    commitCard: {
      background: "#12110F",
      color: "#F3ECE3",
      border: "1px solid #2A2724",
      boxShadow: "0 18px 50px rgba(18, 17, 15, 0.22)",
    },
    stepPill: {
      display: "inline-block",
      padding: "8px 11px",
      borderRadius: 999,
      fontSize: 12,
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
      fontSize: "clamp(30px, 7vw, 42px)",
      lineHeight: 0.98,
      letterSpacing: "-0.05em",
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 10,
    },
    sub: {
      fontSize: 15,
      color: "#6F6861",
      lineHeight: 1.55,
      marginBottom: 18,
      maxWidth: 420,
    },
    subDark: {
      color: "#A79E93",
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
      padding: "16px 0 12px",
      border: "none",
      borderBottom: "1px solid #CFC5B7",
      background: "transparent",
      color: "#161413",
      fontSize: 20,
      lineHeight: 1.4,
      boxSizing: "border-box",
      outline: "none",
      borderRadius: 0,
    },
    inputDark: {
      borderBottom: "1px solid #3A3530",
      color: "#F3ECE3",
    },
    helper: {
      fontSize: 12,
      color: "#736C64",
      marginTop: 10,
      marginBottom: 18,
    },
    helperDark: {
      color: "#A79E93",
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
    },
    ctaDark: {
      background: "#F3ECE3",
      color: "#12110F",
    },
    ctaMuted: {
      width: "100%",
      padding: "14px 18px",
      borderRadius: 16,
      border: "1px solid #DDD5CA",
      background: "transparent",
      color: "#6F6861",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      marginTop: 10,
    },
    ctaMutedDark: {
      border: "1px solid #2A2724",
      color: "#A79E93",
    },
    moveBox: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 16,
      marginBottom: 18,
    },
    moveBig: {
      fontSize: 24,
      lineHeight: 1.18,
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
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
      background: "#F3ECE3",
      color: "#12110F",
      fontWeight: 800,
      cursor: "pointer",
    },
    statusSecondary: {
      flex: 1,
      minWidth: 140,
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #2A2724",
      background: "transparent",
      color: "#F3ECE3",
      fontWeight: 800,
      cursor: "pointer",
    },
    resultBox: {
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
      borderRadius: 20,
      padding: 16,
      marginTop: 10,
      marginBottom: 16,
    },
    resultMove: {
      fontSize: 22,
      lineHeight: 1.2,
      fontWeight: 500,
      fontFamily:
        'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      marginBottom: 8,
      letterSpacing: "-0.03em",
    },
    resultText: {
      fontSize: 14,
      color: "#6F6861",
      lineHeight: 1.55,
    },
    shareBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
    },
    shareTitle: {
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 6,
    },
    shareText: {
      fontSize: 13,
      color: "#6F6861",
      lineHeight: 1.5,
      marginBottom: 12,
    },
    historyList: {
      display: "grid",
      gap: 10,
    },
    historyCard: {
      padding: 14,
      borderRadius: 18,
      background: "#F7F3EC",
      border: "1px solid #DDD5CA",
    },
    historyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
      flexWrap: "wrap",
    },
    historyDate: {
      fontSize: 12,
      color: "#6F6861",
    },
    statusTag: {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: "#ECE7DE",
      color: "#2B2723",
    },
    historyText: {
      fontSize: 14,
      lineHeight: 1.5,
      color: "#161413",
      marginBottom: 8,
    },
    footer: {
      textAlign: "center",
      fontSize: 12,
      color: "#736C64",
      marginTop: 12,
    },
  };

  const today = new Date();

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.topRow}>
          <div style={styles.badge}>Reset</div>
          <div style={styles.date}>
            {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>

        <div style={styles.trackerCard}>
          <div style={styles.trackerTop}>
            <div>
              <div style={styles.label}>Momentum</div>
              <div style={styles.trackerText}>{doneCount} times you actually moved.</div>
            </div>
            <div style={styles.trackerText}>Last 7 days</div>
          </div>

          <div style={styles.trackerRow}>
            {trackerDays.map((day, idx) => (
              <div key={`${day.label}-${idx}`} style={styles.trackerDay}>
                <div
                  style={{
                    ...styles.dot,
                    ...(day.active ? styles.dotActive : {}),
                  }}
                />
                {day.label}
              </div>
            ))}
          </div>
        </div>

        {screen === "start" ? (
          <div style={styles.heroCard}>
            <div style={styles.heroOverlay}>
              <div style={styles.heroTop}>
                <div style={styles.heroTitle}>Empty your head. Take action.</div>
                <div style={styles.heroSub}>Clarity comes when you stop running.</div>
              </div>

              <div style={styles.heroBottom}>
                <button style={styles.startButton} onClick={() => setScreen("mind")}>
                  Start
                </button>
                <div style={styles.heroFoot}>This is for you, not for anyone.</div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              ...styles.card,
              ...(screen === "commit" ? styles.commitCard : {}),
            }}
          >
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
                <div style={{ ...styles.stepPill, ...styles.stepPillDark }}>Commit</div>
                <div style={styles.title}>Do it.</div>
                <div style={{ ...styles.sub, ...styles.subDark }}>No more thinking.</div>

                <div style={styles.moveBox}>
                  <div style={{ ...styles.label, color: "#A79E93" }}>Your move</div>
                  <div style={styles.moveBig}>{move}</div>
                </div>

                <div style={styles.countdownWrap}>
                  <div style={styles.countdown}>{countdown}</div>
                  <div style={styles.countdownText}>Just start.</div>
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
                    {latestEntry.avoiding} · {formatDate(latestEntry.createdAt)}
                  </div>
                </div>

                <div style={styles.shareBox}>
                  <div style={styles.shareTitle}>Accountability</div>
                  <div style={styles.shareText}>Send it to one person. Make it harder to disappear.</div>
                  <button style={styles.cta} onClick={shareMove}>
                    {shareCopied ? "Copied" : "Share my move"}
                  </button>
                </div>

                <button style={styles.ctaMuted} onClick={() => setScreen("history")}>
                  View history
                </button>

                <button style={styles.ctaMuted} onClick={resetFlow}>
                  Again
                </button>
              </>
            )}

            {screen === "history" && (
              <>
                <div style={styles.stepPill}>History</div>
                <div style={styles.title}>Here&apos;s what happened.</div>
                <div style={styles.sub}>No story. Just the pattern.</div>

                <div style={styles.historyList}>
                  {entries.length === 0 ? (
                    <div style={styles.historyCard}>
                      <div style={styles.historyText}>Nothing yet.</div>
                    </div>
                  ) : (
                    entries.map((entry) => (
                      <div key={entry.id} style={styles.historyCard}>
                        <div style={styles.historyTop}>
                          <div style={styles.historyDate}>{formatDate(entry.createdAt)}</div>
                          <div style={styles.statusTag}>
                            {entry.status === "done" ? "Done" : "Not yet"}
                          </div>
                        </div>

                        <div style={styles.historyText}>
                          <strong>Mind:</strong> {entry.mind}
                        </div>
                        <div style={styles.historyText}>
                          <strong>Avoiding:</strong> {entry.avoiding}
                        </div>
                        <div style={{ ...styles.historyText, marginBottom: 0 }}>
                          <strong>Move:</strong> {entry.move}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button style={styles.ctaMuted} onClick={resetFlow}>
                  Back home
                </button>
              </>
            )}
          </div>
        )}

        <div style={styles.footer}>For when your head is full and you still need to move.</div>
      </div>
    </div>
  );
}

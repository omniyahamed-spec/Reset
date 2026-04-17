import React, { CSSProperties, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "reset90_entries_v1";

type ViewMode = "reset" | "past";

interface ResetEntry {
  id: number;
  createdAt: string;
  displayDate: string;
  displayTime: string;
  bothering: string;
  avoiding: string;
  nextMove: string;
  actionTime: string;
  deadline: string;
}

export default function Reset90App() {
  const now = useMemo(() => new Date(), []);
  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const [bothering, setBothering] = useState<string>("");
  const [avoiding, setAvoiding] = useState<string>("");
  const [nextMove, setNextMove] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [done, setDone] = useState<boolean>(false);
  const [entries, setEntries] = useState<ResetEntry[]>([]);
  const [activeView, setActiveView] = useState<ViewMode>("reset");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as ResetEntry[]);
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

  const canComplete = Boolean(bothering.trim() && avoiding.trim() && nextMove.trim());

  function handleCompleteReset(): void {
    if (!canComplete) return;

    const entry: ResetEntry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      displayTime: new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
      bothering: bothering.trim(),
      avoiding: avoiding.trim(),
      nextMove: nextMove.trim(),
      actionTime: time,
      deadline,
    };

    setEntries((prev) => [entry, ...prev]);
    setDone(true);
    setActiveView("reset");

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "reset_completed");
    }
  }

  function handleNewReset(): void {
    setBothering("");
    setAvoiding("");
    setNextMove("");
    setTime("");
    setDeadline("");
    setDone(false);
    setActiveView("reset");
  }

  function handleDeleteEntry(id: number): void {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  const navButton = (active: boolean): CSSProperties => ({
    padding: "11px 16px",
    borderRadius: 999,
    border: active ? "1px solid #1b1815" : "1px solid rgba(122, 113, 104, 0.2)",
    background: active ? "#1b1815" : "rgba(255,255,255,0.68)",
    color: active ? "#ffffff" : "#51493f",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: active ? "0 10px 24px rgba(27, 24, 21, 0.16)" : "none",
    backdropFilter: "blur(10px)",
  });

  const primaryButton = (enabled: boolean): CSSProperties => ({
    padding: "14px 18px",
    borderRadius: 18,
    border: "none",
    background: enabled
      ? "linear-gradient(135deg, #1d1a16 0%, #3b332b 100%)"
      : "#aaa196",
    color: "white",
    fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 14,
    boxShadow: enabled ? "0 14px 28px rgba(29, 26, 22, 0.18)" : "none",
  });

  const glassCard: CSSProperties = {
    background: "rgba(255, 253, 249, 0.78)",
    border: "1px solid rgba(227, 219, 207, 0.75)",
    boxShadow: "0 24px 60px rgba(67, 53, 33, 0.08)",
    backdropFilter: "blur(14px)",
  };

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top left, rgba(255,255,255,0.8) 0%, rgba(246,242,235,1) 35%, rgba(241,234,225,1) 100%)",
      color: "#1f1c18",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "28px 16px 56px",
      boxSizing: "border-box",
    },
    container: {
      maxWidth: 860,
      margin: "0 auto",
    },
    hero: {
      ...glassCard,
      borderRadius: 28,
      padding: "24px 22px 22px",
      marginBottom: 18,
      overflow: "hidden",
      position: "relative",
    },
    heroGlow: {
      position: "absolute",
      width: 220,
      height: 220,
      right: -60,
      top: -80,
      background: "radial-gradient(circle, rgba(227,211,188,0.7) 0%, rgba(227,211,188,0) 70%)",
      pointerEvents: "none",
    },
    badge: {
      border: "1px solid rgba(221, 211, 198, 0.9)",
      borderRadius: 999,
      padding: "7px 12px",
      fontSize: 11,
      letterSpacing: "0.24em",
      color: "#7a7168",
      display: "inline-block",
      background: "rgba(251,248,243,0.9)",
      position: "relative",
      zIndex: 1,
    },
    h1: {
      fontSize: "clamp(32px, 6.5vw, 48px)",
      marginTop: 16,
      marginBottom: 10,
      fontWeight: 700,
      letterSpacing: "-0.05em",
      lineHeight: 1.02,
      maxWidth: 560,
      position: "relative",
      zIndex: 1,
    },
    sub: {
      fontSize: 16,
      color: "#6a6258",
      lineHeight: 1.65,
      margin: 0,
      maxWidth: 540,
      position: "relative",
      zIndex: 1,
    },
    progressRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
      position: "relative",
      zIndex: 1,
    },
    progressPill: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.7)",
      color: "#6b6259",
      fontSize: 12,
      fontWeight: 600,
      border: "1px solid rgba(222, 213, 201, 0.7)",
    },
    topNav: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
      position: "relative",
      zIndex: 1,
    },
    card: {
      ...glassCard,
      borderRadius: 28,
      padding: 24,
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",
      marginBottom: 24,
      flexWrap: "wrap",
      gap: 14,
    },
    dateBlock: {
      padding: "4px 0",
    },
    date: {
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      marginBottom: 5,
    },
    time: {
      fontSize: 13,
      color: "#7a7168",
    },
    presenceBox: {
      background: "linear-gradient(135deg, rgba(244,239,231,0.9) 0%, rgba(250,246,240,0.9) 100%)",
      padding: 16,
      borderRadius: 18,
      border: "1px solid rgba(229, 221, 209, 0.9)",
      maxWidth: 360,
      fontSize: 13,
      lineHeight: 1.6,
      color: "#655d54",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 9,
      display: "block",
      color: "#2c2722",
      letterSpacing: "-0.01em",
    },
    textarea: {
      width: "100%",
      borderRadius: 18,
      border: "1px solid rgba(220, 211, 199, 1)",
      padding: 16,
      fontSize: 14,
      lineHeight: 1.65,
      background: "rgba(250,247,242,0.95)",
      boxSizing: "border-box",
      minHeight: 116,
      resize: "vertical",
      outline: "none",
      boxShadow: "inset 0 1px 3px rgba(60, 50, 37, 0.04)",
    },
    helper: {
      marginTop: 8,
      fontSize: 12,
      color: "#80766d",
      lineHeight: 1.55,
    },
    accountability: {
      background: "linear-gradient(135deg, rgba(244,239,231,0.95) 0%, rgba(249,245,239,0.95) 100%)",
      padding: 18,
      borderRadius: 18,
      marginTop: 8,
      marginBottom: 22,
      border: "1px solid rgba(229, 221, 209, 1)",
    },
    accountTitle: {
      fontWeight: 700,
      fontSize: 14,
      marginBottom: 6,
    },
    accountText: {
      fontSize: 13,
      color: "#6f665d",
      lineHeight: 1.55,
      marginBottom: 12,
    },
    inputs: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    },
    inputWrap: {
      display: "grid",
      gap: 6,
    },
    inputLabel: {
      fontSize: 12,
      color: "#786f66",
      fontWeight: 700,
      letterSpacing: "0.01em",
    },
    input: {
      width: "100%",
      padding: "13px 12px",
      borderRadius: 14,
      border: "1px solid rgba(220, 211, 199, 1)",
      background: "rgba(255,253,249,0.98)",
      boxSizing: "border-box",
      outline: "none",
      fontSize: 14,
    },
    buttonRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    buttonSecondary: {
      padding: "14px 18px",
      borderRadius: 18,
      border: "1px solid rgba(220, 211, 199, 1)",
      background: "rgba(255,253,249,0.92)",
      color: "#3d362f",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: 14,
    },
    result: {
      marginTop: 22,
      padding: 18,
      borderRadius: 18,
      background: "linear-gradient(135deg, rgba(238,231,220,0.95) 0%, rgba(247,242,235,0.95) 100%)",
      border: "1px solid rgba(221, 211, 196, 1)",
      boxShadow: "0 10px 22px rgba(84, 68, 46, 0.06)",
    },
    resultTitle: {
      fontWeight: 700,
      marginBottom: 8,
      fontSize: 12,
      color: "#655c53",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
    resultMove: {
      fontSize: 20,
      lineHeight: 1.45,
      fontWeight: 700,
      marginBottom: 8,
      letterSpacing: "-0.03em",
    },
    resultText: {
      fontSize: 13,
      color: "#655c53",
      lineHeight: 1.65,
    },
    listWrap: {
      display: "grid",
      gap: 12,
    },
    emptyState: {
      ...glassCard,
      borderRadius: 22,
      padding: 22,
      color: "#6c645c",
      lineHeight: 1.7,
    },
    entryCard: {
      ...glassCard,
      borderRadius: 22,
      padding: 18,
    },
    entryTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      marginBottom: 14,
    },
    entryMeta: {
      fontSize: 12,
      color: "#7a7168",
      lineHeight: 1.55,
    },
    entryBlock: {
      marginBottom: 12,
    },
    entryLabel: {
      fontSize: 11,
      color: "#7a7168",
      fontWeight: 700,
      marginBottom: 5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
    entryText: {
      fontSize: 14,
      lineHeight: 1.65,
      color: "#2f2a25",
      whiteSpace: "pre-wrap",
    },
    deleteButton: {
      border: "1px solid rgba(221, 211, 198, 1)",
      background: "rgba(251,248,243,0.95)",
      color: "#5f564d",
      borderRadius: 12,
      padding: "8px 10px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    },
    footerNote: {
      marginTop: 18,
      fontSize: 12,
      color: "#8a8178",
      lineHeight: 1.65,
      textAlign: "center",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.badge}>RESET</div>
          <h1 style={styles.h1}>Clear your mind. Make one move.</h1>
          <p style={styles.sub}>Stop looping. Name it. Face it. Move.</p>

          <div style={styles.progressRow}>
            <div style={styles.progressPill}>90-second reset</div>
            <div style={styles.progressPill}>Honest reflection</div>
            <div style={styles.progressPill}>One clear action</div>
          </div>

          <div style={styles.topNav}>
            <button style={navButton(activeView === "reset")} onClick={() => setActiveView("reset")}>
              Today&apos;s Reset
            </button>
            <button style={navButton(activeView === "past")} onClick={() => setActiveView("past")}>
              Past Resets ({entries.length})
            </button>
            <button style={navButton(false)} onClick={handleNewReset}>
              New Reset
            </button>
          </div>
        </div>

        {activeView === "reset" ? (
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.dateBlock}>
                <div style={styles.date}>{formattedDate}</div>
                <div style={styles.time}>Started at {formattedTime}</div>
              </div>

              <div style={styles.presenceBox}>
                Be honest with today. Name the real issue, catch the avoidance, and choose one move before you open something else.
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>1. What is actually bothering me?</label>
              <textarea
                style={styles.textarea}
                placeholder="Name the real issue, not the polished version."
                value={bothering}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBothering(e.target.value)}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.label}>2. What am I avoiding?</label>
              <textarea
                style={styles.textarea}
                placeholder="What are you postponing, softening, or dodging?"
                value={avoiding}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAvoiding(e.target.value)}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.label}>3. What is the smallest next move?</label>
              <textarea
                style={{ ...styles.textarea, minHeight: 96 }}
                placeholder="Write one move you can start in under 2 minutes."
                value={nextMove}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNextMove(e.target.value)}
              />
              <div style={styles.helper}>Keep it specific. Not a plan. Not a promise. One visible action.</div>
            </div>

            <div style={styles.accountability}>
              <div style={styles.accountTitle}>Accountability</div>
              <div style={styles.accountText}>Decide when you will do it. A move with no time attached is usually just another thought.</div>
              <div style={styles.inputs}>
                <div style={styles.inputWrap}>
                  <label style={styles.inputLabel}>I will do it at</label>
                  <input
                    type="time"
                    style={styles.input}
                    value={time}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value)}
                  />
                </div>
                <div style={styles.inputWrap}>
                  <label style={styles.inputLabel}>Deadline</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={deadline}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button style={primaryButton(canComplete)} onClick={handleCompleteReset} disabled={!canComplete}>
                Do it
              </button>
              <button style={styles.buttonSecondary} onClick={() => setActiveView("past")}>
                View Past Resets
              </button>
            </div>

            {done && (
              <div style={styles.result}>
                <div style={styles.resultTitle}>Your move</div>
                <div style={styles.resultMove}>{nextMove}</div>
                <div style={styles.resultText}>
                  Close this. Do it now. Then come back.
                  {time ? ` Start at ${time}.` : ""}
                  {deadline ? ` Finish by ${deadline}.` : ""}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.listWrap}>
            {entries.length === 0 ? (
              <div style={styles.emptyState}>No resets saved yet. Do one honest reset first.</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} style={styles.entryCard}>
                  <div style={styles.entryTop}>
                    <div style={styles.entryMeta}>
                      <div>{entry.displayDate}</div>
                      <div>{entry.displayTime}</div>
                      {entry.actionTime ? <div>Action time: {entry.actionTime}</div> : null}
                      {entry.deadline ? <div>Deadline: {entry.deadline}</div> : null}
                    </div>
                    <button style={styles.deleteButton} onClick={() => handleDeleteEntry(entry.id)}>
                      Delete
                    </button>
                  </div>

                  <div style={styles.entryBlock}>
                    <div style={styles.entryLabel}>Bothering me</div>
                    <div style={styles.entryText}>{entry.bothering}</div>
                  </div>

                  <div style={styles.entryBlock}>
                    <div style={styles.entryLabel}>Avoiding</div>
                    <div style={styles.entryText}>{entry.avoiding}</div>
                  </div>

                  <div style={{ ...styles.entryBlock, marginBottom: 0 }}>
                    <div style={styles.entryLabel}>Next move</div>
                    <div style={styles.entryText}>{entry.nextMove}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div style={styles.footerNote}>For people who think too much and act too little.</div>
      </div>
    </div>
  );
}

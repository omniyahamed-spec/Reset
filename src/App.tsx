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

  function trackPastResets(): void {
    setActiveView("past");
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "past_resets_viewed");
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top, rgba(47,38,31,0.55) 0%, rgba(18,16,14,1) 32%, rgba(11,10,9,1) 100%)",
      color: "#f3ece3",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "28px 16px 56px",
      boxSizing: "border-box",
    },
    shell: {
      maxWidth: 920,
      margin: "0 auto",
    },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: 26,
    },
    brand: {
      fontSize: 12,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color: "rgba(243,236,227,0.64)",
    },
    nav: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    navButton: {
      padding: "10px 14px",
      borderRadius: 999,
      border: "1px solid rgba(243,236,227,0.12)",
      background: "rgba(255,255,255,0.04)",
      color: "rgba(243,236,227,0.86)",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      backdropFilter: "blur(8px)",
    },
    hero: {
      display: "grid",
      gap: 18,
      marginBottom: 30,
    },
    dateRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
    },
    dateText: {
      fontSize: 13,
      color: "rgba(243,236,227,0.62)",
      letterSpacing: "0.03em",
    },
    h1: {
      margin: 0,
      fontSize: "clamp(42px, 9vw, 78px)",
      lineHeight: 0.94,
      letterSpacing: "-0.06em",
      fontWeight: 700,
      maxWidth: 720,
      color: "#f7f1ea",
    },
    sub: {
      margin: 0,
      fontSize: 18,
      lineHeight: 1.7,
      color: "rgba(243,236,227,0.72)",
      maxWidth: 540,
    },
    panel: {
      border: "1px solid rgba(243,236,227,0.08)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      borderRadius: 32,
      backdropFilter: "blur(18px)",
      boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
      overflow: "hidden",
    },
    panelInner: {
      padding: "28px 22px 22px",
    },
    panelTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 16,
      alignItems: "flex-start",
      flexWrap: "wrap",
      marginBottom: 24,
    },
    panelMeta: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "rgba(243,236,227,0.46)",
      marginBottom: 10,
    },
    panelHint: {
      maxWidth: 330,
      fontSize: 13,
      lineHeight: 1.7,
      color: "rgba(243,236,227,0.64)",
      padding: "14px 16px",
      borderRadius: 20,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(243,236,227,0.08)",
    },
    fieldSection: {
      marginBottom: 22,
    },
    fieldLabel: {
      display: "block",
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "rgba(243,236,227,0.54)",
      marginBottom: 12,
      fontWeight: 700,
    },
    textarea: {
      width: "100%",
      minHeight: 110,
      resize: "vertical",
      border: "none",
      borderBottom: "1px solid rgba(243,236,227,0.12)",
      background: "transparent",
      color: "#f6efe7",
      fontSize: 22,
      lineHeight: 1.55,
      padding: "0 0 16px 0",
      outline: "none",
      boxSizing: "border-box",
    },
    helper: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 1.65,
      color: "rgba(243,236,227,0.42)",
    },
    accountability: {
      marginTop: 10,
      marginBottom: 24,
      padding: 18,
      borderRadius: 24,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(243,236,227,0.08)",
    },
    accountabilityTitle: {
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "rgba(243,236,227,0.54)",
      marginBottom: 8,
      fontWeight: 700,
    },
    accountabilityText: {
      marginBottom: 14,
      fontSize: 13,
      lineHeight: 1.65,
      color: "rgba(243,236,227,0.58)",
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
      color: "rgba(243,236,227,0.46)",
      fontWeight: 700,
      letterSpacing: "0.04em",
    },
    input: {
      width: "100%",
      padding: "13px 14px",
      borderRadius: 16,
      border: "1px solid rgba(243,236,227,0.1)",
      background: "rgba(255,255,255,0.04)",
      color: "#f6efe7",
      fontSize: 14,
      boxSizing: "border-box",
      outline: "none",
    },
    buttonRow: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
    },
    primaryButton: {
      padding: "15px 24px",
      borderRadius: 999,
      border: "none",
      background: "linear-gradient(135deg, #f4ede2 0%, #cbb79d 100%)",
      color: "#171412",
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      boxShadow: "0 16px 34px rgba(203,183,157,0.2)",
    },
    secondaryButton: {
      padding: "15px 18px",
      borderRadius: 999,
      border: "1px solid rgba(243,236,227,0.12)",
      background: "rgba(255,255,255,0.04)",
      color: "rgba(243,236,227,0.86)",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
    },
    disabledButton: {
      opacity: 0.44,
      cursor: "not-allowed",
    },
    result: {
      marginTop: 24,
      padding: 22,
      borderRadius: 24,
      background: "linear-gradient(135deg, rgba(244,237,226,0.12) 0%, rgba(203,183,157,0.08) 100%)",
      border: "1px solid rgba(243,236,227,0.12)",
    },
    resultLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "rgba(243,236,227,0.5)",
      marginBottom: 8,
      fontWeight: 700,
    },
    resultMove: {
      fontSize: 28,
      lineHeight: 1.35,
      letterSpacing: "-0.04em",
      fontWeight: 700,
      color: "#f8f2eb",
      marginBottom: 10,
    },
    resultText: {
      fontSize: 14,
      lineHeight: 1.7,
      color: "rgba(243,236,227,0.7)",
    },
    historyWrap: {
      display: "grid",
      gap: 14,
    },
    emptyState: {
      borderRadius: 26,
      padding: 28,
      border: "1px solid rgba(243,236,227,0.08)",
      background: "rgba(255,255,255,0.03)",
      color: "rgba(243,236,227,0.64)",
      lineHeight: 1.75,
      fontSize: 15,
    },
    entryCard: {
      borderRadius: 26,
      padding: 20,
      border: "1px solid rgba(243,236,227,0.08)",
      background: "rgba(255,255,255,0.03)",
      backdropFilter: "blur(14px)",
    },
    entryTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      marginBottom: 14,
      flexWrap: "wrap",
    },
    entryMeta: {
      fontSize: 12,
      lineHeight: 1.6,
      color: "rgba(243,236,227,0.52)",
    },
    entryBlock: {
      marginBottom: 14,
    },
    entryLabel: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "rgba(243,236,227,0.44)",
      fontWeight: 700,
      marginBottom: 6,
    },
    entryText: {
      fontSize: 16,
      lineHeight: 1.7,
      color: "#f1e9df",
      whiteSpace: "pre-wrap",
    },
    deleteButton: {
      border: "1px solid rgba(243,236,227,0.1)",
      background: "rgba(255,255,255,0.04)",
      color: "rgba(243,236,227,0.82)",
      borderRadius: 999,
      padding: "10px 12px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    },
    footer: {
      marginTop: 20,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 1.7,
      color: "rgba(243,236,227,0.36)",
      letterSpacing: "0.03em",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <div style={styles.brand}>Reset</div>
          <div style={styles.nav}>
            <button style={styles.navButton} onClick={() => setActiveView("reset")}>Today&apos;s Reset</button>
            <button style={styles.navButton} onClick={trackPastResets}>History</button>
            <button style={styles.navButton} onClick={handleNewReset}>New</button>
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.dateRow}>
            <div style={styles.dateText}>{formattedDate} · {formattedTime}</div>
          </div>
          <h1 style={styles.h1}>Clear your mind. Make one move.</h1>
          <p style={styles.sub}>Stop looping. Name it. Face it. Move.</p>
        </div>

        {activeView === "reset" ? (
          <div style={styles.panel}>
            <div style={styles.panelInner}>
              <div style={styles.panelTop}>
                <div>
                  <div style={styles.panelMeta}>Today&apos;s reset</div>
                </div>
                <div style={styles.panelHint}>
                  Be honest with today. Name the real issue, catch the avoidance, and choose one move before you open something else.
                </div>
              </div>

              <div style={styles.fieldSection}>
                <label style={styles.fieldLabel}>What is actually bothering me?</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Name the real issue, not the polished version."
                  value={bothering}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBothering(e.target.value)}
                />
              </div>

              <div style={styles.fieldSection}>
                <label style={styles.fieldLabel}>What am I avoiding?</label>
                <textarea
                  style={styles.textarea}
                  placeholder="What are you postponing, softening, or dodging?"
                  value={avoiding}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAvoiding(e.target.value)}
                />
              </div>

              <div style={styles.fieldSection}>
                <label style={styles.fieldLabel}>What is the smallest next move?</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: 92 }}
                  placeholder="Write one move you can start in under 2 minutes."
                  value={nextMove}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNextMove(e.target.value)}
                />
                <div style={styles.helper}>Keep it specific. Not a plan. Not a promise. One visible action.</div>
              </div>

              <div style={styles.accountability}>
                <div style={styles.accountabilityTitle}>Accountability</div>
                <div style={styles.accountabilityText}>Decide when you will do it. A move with no time attached is usually just another thought.</div>
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
                <button
                  style={{ ...styles.primaryButton, ...(canComplete ? {} : styles.disabledButton) }}
                  onClick={handleCompleteReset}
                  disabled={!canComplete}
                >
                  Do it
                </button>
                <button style={styles.secondaryButton} onClick={trackPastResets}>
                  View Past Resets
                </button>
              </div>

              {done && (
                <div style={styles.result}>
                  <div style={styles.resultLabel}>Your move</div>
                  <div style={styles.resultMove}>{nextMove}</div>
                  <div style={styles.resultText}>
                    Close this. Do it now. Then come back.
                    {time ? ` Start at ${time}.` : ""}
                    {deadline ? ` Finish by ${deadline}.` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.historyWrap}>
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

        <div style={styles.footer}>For people who think too much and act too little.</div>
      </div>
    </div>
  );
}

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
      if (raw) {
        setEntries(JSON.parse(raw) as ResetEntry[]);
      }
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

  const canComplete = Boolean(
    bothering.trim() && avoiding.trim() && nextMove.trim()
  );

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
    padding: "10px 14px",
    borderRadius: 999,
    border: active ? "1px solid #1e1a16" : "1px solid #ddd3c6",
    background: active ? "#1e1a16" : "#fbf8f3",
    color: active ? "#ffffff" : "#51493f",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  });

  const primaryButton = (enabled: boolean): CSSProperties => ({
    padding: "12px 18px",
    borderRadius: 16,
    border: "none",
    background: enabled ? "#1e1a16" : "#9d948a",
    color: "white",
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 14,
  });

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#f6f2eb",
      color: "#1f1c18",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "28px 16px 48px",
      boxSizing: "border-box",
    },
    container: {
      maxWidth: 760,
      margin: "0 auto",
    },
    badge: {
      border: "1px solid #ddd3c6",
      borderRadius: 999,
      padding: "6px 12px",
      fontSize: 12,
      letterSpacing: "0.2em",
      color: "#7a7168",
      display: "inline-block",
      background: "#fbf8f3",
    },
    header: {
      marginBottom: 24,
    },
    h1: {
      fontSize: "clamp(30px, 7vw, 42px)",
      marginTop: 16,
      marginBottom: 8,
      fontWeight: 600,
      letterSpacing: "-0.04em",
      lineHeight: 1.05,
    },
    sub: {
      fontSize: 16,
      color: "#6a6258",
      lineHeight: 1.6,
      margin: 0,
      maxWidth: 560,
    },
    topNav: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
    },
    card: {
      background: "#fffdf9",
      borderRadius: 24,
      padding: 22,
      border: "1px solid #e3dbcf",
      boxShadow: "0 12px 30px rgba(67, 53, 33, 0.05)",
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 22,
      flexWrap: "wrap",
      gap: 12,
    },
    date: {
      fontSize: 20,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      marginBottom: 4,
    },
    time: {
      fontSize: 13,
      color: "#7a7168",
    },
    presenceBox: {
      background: "#f4efe7",
      padding: 14,
      borderRadius: 16,
      border: "1px solid #e5ddd1",
      maxWidth: 320,
      fontSize: 13,
      lineHeight: 1.55,
      color: "#655d54",
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 8,
      display: "block",
      color: "#2c2722",
    },
    textarea: {
      width: "100%",
      borderRadius: 16,
      border: "1px solid #dcd3c7",
      padding: 14,
      fontSize: 14,
      lineHeight: 1.6,
      background: "#faf7f2",
      boxSizing: "border-box",
      minHeight: 110,
      resize: "vertical",
      outline: "none",
    },
    helper: {
      marginTop: 8,
      fontSize: 12,
      color: "#80766d",
      lineHeight: 1.5,
    },
    accountability: {
      background: "#f4efe7",
      padding: 16,
      borderRadius: 16,
      marginTop: 4,
      marginBottom: 20,
      border: "1px solid #e5ddd1",
    },
    accountTitle: {
      fontWeight: 600,
      fontSize: 14,
      marginBottom: 6,
    },
    accountText: {
      fontSize: 13,
      color: "#6f665d",
      lineHeight: 1.5,
      marginBottom: 12,
    },
    inputs: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 10,
    },
    inputWrap: {
      display: "grid",
      gap: 6,
    },
    inputLabel: {
      fontSize: 12,
      color: "#786f66",
      fontWeight: 600,
    },
    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 12,
      border: "1px solid #dcd3c7",
      background: "#fffdf9",
      boxSizing: "border-box",
      outline: "none",
      fontSize: 14,
    },
    buttonRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    buttonSecondary: {
      padding: "12px 18px",
      borderRadius: 16,
      border: "1px solid #dcd3c7",
      background: "#fffdf9",
      color: "#3d362f",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: 14,
    },
    result: {
      marginTop: 20,
      padding: 16,
      borderRadius: 16,
      background: "#eee7dc",
      border: "1px solid #ddd3c4",
    },
    resultTitle: {
      fontWeight: 600,
      marginBottom: 8,
      fontSize: 13,
      color: "#655c53",
    },
    resultMove: {
      fontSize: 18,
      lineHeight: 1.5,
      fontWeight: 600,
      marginBottom: 8,
    },
    resultText: {
      fontSize: 13,
      color: "#655c53",
      lineHeight: 1.6,
    },
    listWrap: {
      display: "grid",
      gap: 12,
    },
    emptyState: {
      background: "#fffdf9",
      borderRadius: 20,
      padding: 22,
      border: "1px solid #e3dbcf",
      color: "#6c645c",
      lineHeight: 1.6,
    },
    entryCard: {
      background: "#fffdf9",
      borderRadius: 20,
      padding: 18,
      border: "1px solid #e3dbcf",
      boxShadow: "0 10px 22px rgba(67, 53, 33, 0.04)",
    },
    entryTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      marginBottom: 12,
    },
    entryMeta: {
      fontSize: 12,
      color: "#7a7168",
      lineHeight: 1.5,
    },
    entryBlock: {
      marginBottom: 12,
    },
    entryLabel: {
      fontSize: 12,
      color: "#7a7168",
      fontWeight: 600,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    },
    entryText: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "#2f2a25",
      whiteSpace: "pre-wrap",
    },
    deleteButton: {
      border: "1px solid #ddd3c6",
      background: "#fbf8f3",
      color: "#5f564d",
      borderRadius: 12,
      padding: "8px 10px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 600,
    },
    footerNote: {
      marginTop: 18,
      fontSize: 12,
      color: "#8a8178",
      lineHeight: 1.6,
      textAlign: "center",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.badge}>RESET</div>
          <h1 style={styles.h1}>
            Clear your mind.
          </h1>
          <p style={styles.sub}>
            Three prompts. One decision. A simple record of whether you followed through.
          </p>

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
              <div>
                <div style={styles.date}>{formattedDate}</div>
                <div style={styles.time}>Started at {formattedTime}</div>
              </div>

              <div style={styles.presenceBox}>
                Be honest with today. Name the real issue, catch the avoidance, and pick one move before you open something else.
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
              <div style={styles.helper}>
                Keep it specific. Not a plan. Not a promise. One visible action.
              </div>
            </div>

            <div style={styles.accountability}>
              <div style={styles.accountTitle}>Accountability</div>
              <div style={styles.accountText}>
                Decide when you will do it. A move with no time attached is usually just another thought.
              </div>
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
                style={primaryButton(canComplete)}
                onClick={handleCompleteReset}
                disabled={!canComplete}
              >
                Complete Reset
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
                  Now close this and do it.
                  {time ? ` Start at ${time}.` : ""}
                  {deadline ? ` Finish by ${deadline}.` : ""}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.listWrap}>
            {entries.length === 0 ? (
              <div style={styles.emptyState}>
                No resets saved yet. Do one honest reset first.
              </div>
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

        <div style={styles.footerNote}>
          MVP rule: launch this before adding accounts, analytics, streaks, or notifications.
        </div>
      </div>
    </div>
  );
}

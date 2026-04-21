import React, { CSSProperties, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "reset90_entries_v2";
const SPARKS_KEY = "reset90_sparks_v1";

type ViewMode = "reset" | "past";
type EntryStatus = "pending" | "done" | "not_yet";

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
  status: EntryStatus;
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
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
  const [latestId, setLatestId] = useState<number | null>(null);
  const [sparks, setSparks] = useState<number>(0);

  useEffect(() => {
    try {
      const rawEntries = localStorage.getItem(STORAGE_KEY);
      if (rawEntries) {
        setEntries(JSON.parse(rawEntries) as ResetEntry[]);
      }

      const rawSparks = localStorage.getItem(SPARKS_KEY);
      if (rawSparks) {
        const parsed = Number(rawSparks);
        setSparks(Number.isFinite(parsed) ? parsed : 0);
      }
    } catch (error) {
      console.error("Failed to load data", error);
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
    try {
      localStorage.setItem(SPARKS_KEY, String(sparks));
    } catch (error) {
      console.error("Failed to save sparks", error);
    }
  }, [sparks]);

  const canComplete = Boolean(
    bothering.trim() && avoiding.trim() && nextMove.trim()
  );

  const latestEntry = useMemo(
    () => entries.find((entry) => entry.id === latestId) ?? null,
    [entries, latestId]
  );

  const trackerDays = useMemo(() => {
    const today = new Date();
    const days: { label: string; active: boolean }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(today.getDate() - i);

      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const active = entries.some((entry) => {
        if (entry.status !== "done") return false;
        const entryDate = new Date(entry.createdAt);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === d.getTime();
      });

      days.push({ label, active });
    }

    return days;
  }, [entries]);

  function trackEvent(eventName: string, params: Record<string, string | number> = {}): void {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  }

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
      status: "pending",
    };

    const nextEntries = [entry, ...entries].slice(0, 5);
    setEntries(nextEntries);
    setLatestId(entry.id);
    setDone(true);
    setActiveView("reset");

    trackEvent("reset_completed");
  }

  function handleNewReset(): void {
    setBothering("");
    setAvoiding("");
    setNextMove("");
    setTime("");
    setDeadline("");
    setDone(false);
    setLatestId(null);
    setActiveView("reset");
  }

  function handleDeleteEntry(id: number): void {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  function handleStatusUpdate(id: number, status: EntryStatus): void {
    const oldEntry = entries.find((entry) => entry.id === id);

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, status } : entry
      )
    );

    if (status === "done" && oldEntry?.status !== "done") {
      setSparks((prev) => prev + 1);
      trackEvent("beat_the_scroll");
    }

    trackEvent("status_changed", { status });
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

  const trackerDot = (active: boolean): CSSProperties => ({
    width: 12,
    height: 12,
    borderRadius: 999,
    background: active ? "#1e1a16" : "#d9d1c4",
    margin: "0 auto 6px",
  });

  const statusPill = (status: EntryStatus): CSSProperties => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background:
      status === "done"
        ? "#e7f3e8"
        : status === "not_yet"
        ? "#f6ebdd"
        : "#f1ede6",
    color:
      status === "done"
        ? "#2f6b39"
        : status === "not_yet"
        ? "#8a5a1f"
        : "#6f665d",
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
      marginBottom: 20,
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
    trackerCard: {
      background: "#fffdf9",
      borderRadius: 20,
      padding: 18,
      border: "1px solid #e3dbcf",
      marginBottom: 18,
    },
    trackerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      gap: 12,
      flexWrap: "wrap",
    },
    trackerTitle: {
      fontSize: 13,
      color: "#6f665d",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
    trackerMessage: {
      fontSize: 13,
      color: "#6a6258",
    },
    trackerRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
    },
    trackerDay: {
      textAlign: "center",
      fontSize: 12,
      color: "#6f665d",
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
      marginBottom: 18,
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
      minHeight: 96,
      resize: "vertical",
      outline: "none",
    },
    accountability: {
      background: "#f4efe7",
      padding: 16,
      borderRadius: 16,
      marginTop: 4,
      marginBottom: 18,
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
      marginBottom: 12,
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
      flexWrap: "wrap",
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
          <h1 style={styles.h1}>Clear your mind. Make one move.</h1>
          <p style={styles.sub}>Stop looping. Move.</p>

          <div style={styles.topNav}>
            <button style={navButton(activeView === "reset")} onClick={() => setActiveView("reset")}>
              Reset
            </button>
            <button style={navButton(activeView === "past")} onClick={() => setActiveView("past")}>
              History ({entries.length})
            </button>
            <button style={navButton(false)} onClick={handleNewReset}>
              New
            </button>
          </div>
        </div>

        <div style={styles.trackerCard}>
          <div style={styles.trackerTop}>
            <div style={styles.trackerTitle}>Tracker</div>
            <div style={styles.trackerMessage}>
              {sparks} spark{sparks === 1 ? "" : "s"} —{" "}
              {sparks >= 7
                ? "You came back to yourself."
                : sparks >= 3
                ? "You broke the loop."
                : "One honest move at a time."}
            </div>
          </div>

          <div style={styles.trackerRow}>
            {trackerDays.map((day) => (
              <div key={day.label} style={styles.trackerDay}>
                <div style={trackerDot(day.active)} />
                {day.label}
              </div>
            ))}
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
                Name it. Catch the avoidance. Pick one move.
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>What is actually bothering me?</label>
              <textarea
                style={styles.textarea}
                placeholder="Name the real issue."
                value={bothering}
                maxLength={120}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBothering(e.target.value)}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.label}>What am I avoiding?</label>
              <textarea
                style={styles.textarea}
                placeholder="What are you dodging?"
                value={avoiding}
                maxLength={120}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAvoiding(e.target.value)}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.label}>What is the next visible move?</label>
              <textarea
                style={styles.textarea}
                placeholder="One move only."
                value={nextMove}
                maxLength={120}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNextMove(e.target.value)}
              />
            </div>

            <div style={styles.accountability}>
              <div style={styles.accountTitle}>When?</div>
              <div style={styles.accountText}>Attach a time or deadline.</div>

              <div style={styles.inputs}>
                <div style={styles.inputWrap}>
                  <label style={styles.inputLabel}>Time</label>
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
                Commit to this
              </button>
              <button style={styles.buttonSecondary} onClick={() => setActiveView("past")}>
                View History
              </button>
            </div>

            {done && latestEntry && (
              <div style={styles.result}>
                <div style={styles.resultTitle}>Your move</div>
                <div style={styles.resultMove}>{latestEntry.nextMove}</div>
                <div style={styles.resultText}>
                  Do it now — before your brain escapes.
                  {latestEntry.actionTime ? ` Start at ${latestEntry.actionTime}.` : ""}
                  {latestEntry.deadline ? ` Finish by ${latestEntry.deadline}.` : ""}
                </div>

                <div style={styles.buttonRow}>
                  <button
                    style={primaryButton(true)}
                    onClick={() => handleStatusUpdate(latestEntry.id, "done")}
                  >
                    Yes, I did it
                  </button>
                  <button
                    style={styles.buttonSecondary}
                    onClick={() => handleStatusUpdate(latestEntry.id, "not_yet")}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.listWrap}>
            {entries.length === 0 ? (
              <div style={styles.emptyState}>
                No resets saved yet.
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} style={styles.entryCard}>
                  <div style={styles.entryTop}>
                    <div style={styles.entryMeta}>
                      <div>{entry.displayDate}</div>
                      <div>{entry.displayTime}</div>
                      {entry.actionTime ? <div>Time: {entry.actionTime}</div> : null}
                      {entry.deadline ? <div>Deadline: {entry.deadline}</div> : null}
                    </div>

                    <div style={statusPill(entry.status)}>
                      {entry.status === "done"
                        ? "Done"
                        : entry.status === "not_yet"
                        ? "Not yet"
                        : "Pending"}
                    </div>
                  </div>

                  <div style={styles.entryBlock}>
                    <div style={styles.entryLabel}>Bothering me</div>
                    <div style={styles.entryText}>{entry.bothering}</div>
                  </div>

                  <div style={styles.entryBlock}>
                    <div style={styles.entryLabel}>Avoiding</div>
                    <div style={styles.entryText}>{entry.avoiding}</div>
                  </div>

                  <div style={styles.entryBlock}>
                    <div style={styles.entryLabel}>Next move</div>
                    <div style={styles.entryText}>{entry.nextMove}</div>
                  </div>

                  <div style={styles.buttonRow}>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => handleStatusUpdate(entry.id, "done")}
                    >
                      Done
                    </button>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => handleStatusUpdate(entry.id, "not_yet")}
                    >
                      Not yet
                    </button>
                    <button
                      style={styles.deleteButton}
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div style={styles.footerNote}>
          For people who think too much and act too little.
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";

type Step = "start" | "avoid" | "move" | "commit" | "result";
type EntryStatus = "done" | "not";

interface Entry {
  id: number;
  date: string;
  move: string;
  status: EntryStatus;
}

const STORAGE_KEY = "reset_v4_entries";
const SPARKS_KEY = "reset_v4_sparks";

const AVOIDING_OPTIONS = [
  "Starting",
  "A message",
  "A decision",
  "A work task",
  "Something uncomfortable",
  "A hard truth",
];

const MOVE_OPTIONS = [
  "Send it",
  "Open it",
  "Start 2 min",
  "Reply now",
  "Close tabs",
  "Write 1 line",
];

export default function App() {
  const [step, setStep] = useState<Step>("start");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [countdown, setCountdown] = useState(8);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sparks, setSparks] = useState(0);
  const [lastStatus, setLastStatus] = useState<EntryStatus | null>(null);

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem(STORAGE_KEY);
      const savedSparks = localStorage.getItem(SPARKS_KEY);

      if (savedEntries) {
        setEntries(JSON.parse(savedEntries) as Entry[]);
      }

      if (savedSparks) {
        const parsed = Number(savedSparks);
        setSparks(Number.isFinite(parsed) ? parsed : 0);
      }
    } catch (error) {
      console.error("Failed to load local data", error);
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

  useEffect(() => {
    if (step !== "commit") return;
    if (countdown <= 0) return;

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [step, countdown]);

  const trackerDays = useMemo(() => {
    const today = new Date();
    const days: { label: string; active: boolean }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setHours(0, 0, 0, 0);
      day.setDate(today.getDate() - i);

      const label = day.toLocaleDateString(undefined, { weekday: "short" });

      const active = entries.some((entry) => {
        if (entry.status !== "done") return false;
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === day.getTime();
      });

      days.push({ label, active });
    }

    return days;
  }, [entries]);

  const todayLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  function resetFlow() {
    setAvoiding("");
    setMove("");
    setCountdown(8);
    setLastStatus(null);
    setStep("start");
  }

  function handleStatus(status: EntryStatus) {
    const newEntry: Entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      move,
      status,
    };

    setEntries((prev) => [newEntry, ...prev].slice(0, 7));
    setLastStatus(status);

    if (status === "done") {
      setSparks((prev) => prev + 1);
    }

    setStep("result");
  }

  const canGoNext = avoiding.trim().length > 0;
  const canCommit = move.trim().length > 0;

  const sparkMessage =
    sparks >= 7
      ? "You came back to yourself."
      : sparks >= 3
      ? "You broke the loop."
      : "One honest move at a time.";

  return (
    <>
      <style>{`
        :root {
          --bg: #f6f1e8;
          --bg-2: #efe8dc;
          --card: rgba(255, 252, 247, 0.82);
          --card-strong: #fffdf9;
          --text: #171411;
          --muted: #746c63;
          --line: #ddd2c4;
          --chip: #f4ede3;
          --chip-active: #171411;
          --chip-active-text: #ffffff;
          --primary: #171411;
          --primary-soft: #ede6db;
          --shadow: 0 18px 50px rgba(55, 40, 22, 0.08);
          --success: #163d25;
          --success-bg: #e7f4ea;
          --warning: #7a4a13;
          --warning-bg: #f8ead9;
          --radius-xl: 28px;
          --radius-lg: 20px;
          --radius-md: 16px;
          --radius-sm: 12px;
        }

        * {
          box-sizing: border-box;
        }

        html, body, #root {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at top left, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 28%),
            linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%);
          color: var(--text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        button, input {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 28px 16px 44px;
        }

        .wrap {
          max-width: 560px;
          margin: 0 auto;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .brand {
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--muted);
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.5);
          padding: 7px 11px;
          border-radius: 999px;
        }

        .date {
          font-size: 13px;
          color: var(--muted);
        }

        .tracker {
          background: rgba(255, 252, 247, 0.72);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 16px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          margin-bottom: 18px;
        }

        .tracker-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .tracker-title {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }

        .tracker-copy {
          font-size: 13px;
          color: var(--muted);
        }

        .tracker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .tracker-day {
          text-align: center;
          font-size: 11px;
          color: var(--muted);
        }

        .tracker-dot {
          width: 12px;
          height: 12px;
          margin: 0 auto 6px;
          border-radius: 999px;
          background: #d8cec0;
          transition: transform 160ms ease, background 160ms ease;
        }

        .tracker-dot.active {
          background: var(--primary);
          transform: scale(1.08);
        }

        .panel {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow);
          padding: 24px 20px 20px;
          backdrop-filter: blur(12px);
        }

        .panel.commit-mode {
          background: #15120f;
          color: #fffaf3;
          border-color: #2c241d;
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 12px;
        }

        .commit-mode .eyebrow {
          color: rgba(255, 250, 243, 0.56);
        }

        .title {
          font-size: clamp(32px, 6vw, 42px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          margin: 0 0 10px;
          font-weight: 700;
        }

        .commit-mode .title {
          color: #fffaf3;
        }

        .sub {
          margin: 0 0 22px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.55;
          max-width: 38ch;
        }

        .commit-mode .sub {
          color: rgba(255, 250, 243, 0.68);
        }

        .step {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          border: 1px solid var(--line);
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 16px;
        }

        .commit-mode .step {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.09);
          color: rgba(255, 250, 243, 0.56);
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .chip {
          border: 1px solid var(--line);
          background: var(--chip);
          color: var(--text);
          padding: 12px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: transform 120ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
          font-size: 14px;
          font-weight: 600;
        }

        .chip:hover {
          transform: translateY(-1px);
        }

        .chip:active {
          transform: scale(0.98);
        }

        .chip.active {
          background: var(--chip-active);
          color: var(--chip-active-text);
          border-color: var(--chip-active);
        }

        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.72);
          padding: 14px 15px;
          font-size: 14px;
          outline: none;
          margin-bottom: 10px;
          color: var(--text);
        }

        .input::placeholder {
          color: #9a9186;
        }

        .helper {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 18px;
        }

        .cta {
          width: 100%;
          border: none;
          border-radius: 18px;
          padding: 15px 18px;
          background: var(--primary);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 120ms ease, opacity 120ms ease;
        }

        .cta:hover {
          transform: translateY(-1px);
        }

        .cta:active {
          transform: scale(0.99);
        }

        .cta:disabled {
          opacity: 0.42;
          cursor: not-allowed;
          transform: none;
        }

        .secondary {
          width: 100%;
          margin-top: 10px;
          border-radius: 16px;
          padding: 13px 16px;
          background: transparent;
          border: 1px solid var(--line);
          color: var(--muted);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .move-card {
          background: rgba(255,255,255,0.55);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .move-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
          margin-bottom: 8px;
          font-weight: 700;
        }

        .move-value {
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          font-weight: 700;
        }

        .commit-mode .move-card {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.09);
        }

        .commit-mode .move-label {
          color: rgba(255, 250, 243, 0.56);
        }

        .commit-mode .move-value {
          color: #fffaf3;
        }

        .countdown-wrap {
          display: grid;
          place-items: center;
          padding: 18px 0 12px;
        }

        .countdown {
          font-size: clamp(64px, 18vw, 96px);
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.07em;
          color: #fffaf3;
        }

        .countdown-note {
          margin-top: 8px;
          font-size: 14px;
          color: rgba(255, 250, 243, 0.64);
        }

        .result-box {
          background: var(--primary-soft);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .result-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .result-big {
          font-size: 24px;
          line-height: 1.18;
          font-weight: 700;
          letter-spacing: -0.03em;
          margin-bottom: 10px;
        }

        .status-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .status-btn {
          flex: 1 1 0;
          min-width: 140px;
          border-radius: 16px;
          padding: 14px 16px;
          border: none;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .status-btn.done {
          background: #171411;
          color: white;
        }

        .status-btn.notyet {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--line);
        }

        .result-message {
          margin-top: 16px;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.55;
        }

        .footer-note {
          text-align: center;
          margin-top: 14px;
          font-size: 12px;
          color: var(--muted);
        }

        @media (max-width: 640px) {
          .page {
            padding-top: 20px;
          }

          .panel {
            padding: 20px 16px 16px;
          }

          .status-btn {
            min-width: 100%;
          }
        }
      `}</style>

      <div className="page">
        <div className="wrap">
          <div className="top">
            <div className="brand">Reset</div>
            <div className="date">{todayLabel}</div>
          </div>

          <div className="tracker">
            <div className="tracker-head">
              <div className="tracker-title">Momentum</div>
              <div className="tracker-copy">
                {sparks} spark{sparks === 1 ? "" : "s"} — {sparkMessage}
              </div>
            </div>

            <div className="tracker-grid">
              {trackerDays.map((day, index) => (
                <div key={`${day.label}-${index}`} className="tracker-day">
                  <div className={`tracker-dot ${day.active ? "active" : ""}`} />
                  {day.label}
                </div>
              ))}
            </div>
          </div>

          <div className={`panel ${step === "commit" ? "commit-mode" : ""}`}>
            {step === "start" && (
              <>
                <div className="eyebrow">10 second reset</div>
                <h1 className="title">Break the loop fast.</h1>
                <p className="sub">
                  Catch the drift. Pick one move. Start before your brain escapes.
                </p>

                <button className="cta" onClick={() => setStep("avoid")}>
                  Reset now
                </button>
              </>
            )}

            {step === "avoid" && (
              <>
                <div className="step">Step 1 / 3</div>
                <h1 className="title">What are you avoiding?</h1>
                <p className="sub">Pick the nearest match or write it in one line.</p>

                <div className="chips">
                  {AVOIDING_OPTIONS.map((item) => (
                    <button
                      key={item}
                      className={`chip ${avoiding === item ? "active" : ""}`}
                      onClick={() => setAvoiding(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <input
                  className="input"
                  placeholder="or write your own..."
                  value={avoiding}
                  maxLength={90}
                  onChange={(e) => setAvoiding(e.target.value)}
                />

                <div className="helper">Keep it short. Honest beats polished.</div>

                <button className="cta" disabled={!canGoNext} onClick={() => setStep("move")}>
                  Next
                </button>
                <button className="secondary" onClick={resetFlow}>
                  Cancel
                </button>
              </>
            )}

            {step === "move" && (
              <>
                <div className="step">Step 2 / 3</div>
                <h1 className="title">Pick one move.</h1>
                <p className="sub">Smallest visible action. Not a plan.</p>

                <div className="chips">
                  {MOVE_OPTIONS.map((item) => (
                    <button
                      key={item}
                      className={`chip ${move === item ? "active" : ""}`}
                      onClick={() => setMove(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <input
                  className="input"
                  placeholder="or define your move..."
                  value={move}
                  maxLength={90}
                  onChange={(e) => setMove(e.target.value)}
                />

                <div className="helper">Example: “Open the draft.” “Send the reply.”</div>

                <button
                  className="cta"
                  disabled={!canCommit}
                  onClick={() => {
                    setCountdown(8);
                    setStep("commit");
                  }}
                >
                  Commit
                </button>
                <button className="secondary" onClick={() => setStep("avoid")}>
                  Back
                </button>
              </>
            )}

            {step === "commit" && (
              <>
                <div className="step">Step 3 / 3</div>
                <h1 className="title">Do this now.</h1>
                <p className="sub">No more thinking.</p>

                <div className="move-card">
                  <div className="move-label">Your move</div>
                  <div className="move-value">{move}</div>
                </div>

                <div className="countdown-wrap">
                  <div className="countdown">{countdown}</div>
                  <div className="countdown-note">I’m waiting.</div>
                </div>

                {countdown <= 0 && (
                  <div className="status-row">
                    <button className="status-btn done" onClick={() => handleStatus("done")}>
                      Done
                    </button>
                    <button className="status-btn notyet" onClick={() => handleStatus("not")}>
                      Not yet
                    </button>
                  </div>
                )}
              </>
            )}

            {step === "result" && (
              <>
                <div className="eyebrow">Result</div>
                <h1 className="title">
                  {lastStatus === "done" ? "You broke the loop." : "You caught it."}
                </h1>

                <div className="result-box">
                  <div className="result-title">Move</div>
                  <div className="result-big">{move}</div>
                  <div className="result-message">
                    {lastStatus === "done"
                      ? "Good. Momentum matters more than perfection."
                      : "Good. You saw the pattern. Reset again when you’re ready."}
                  </div>
                </div>

                <div className="status-row">
                  <button className="status-btn done" onClick={resetFlow}>
                    New reset
                  </button>
                  <button className="status-btn notyet" onClick={() => setStep("start")}>
                    Home
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="footer-note">For people who think too much and act too little.</div>
        </div>
      </div>
    </>
  );
}

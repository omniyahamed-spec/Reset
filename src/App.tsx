import React, { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

type View = "reset" | "history";
type Step = 1 | 2 | 3 | 4 | 5;
type Commitment = "now" | "later";
type Status = "pending" | "done" | "not_yet";

type ModeId = "clarity" | "steadiness" | "courage" | "reentry";
type ContextId =
  | "overthinking"
  | "scattered"
  | "cant_start"
  | "stuck_between"
  | "heavy"
  | "pulled_to_phone"
  | "need_calm"
  | "avoiding_message"
  | "avoiding_task"
  | "fear_of_wrong"
  | "waiting_ready"
  | "lost_thread"
  | "interrupted"
  | "drifted_scroll";

type ActionId =
  | "two_min"
  | "open_file"
  | "reply_line"
  | "five_breaths"
  | "wudu_return"
  | "close_tabs"
  | "custom";

interface ChoiceOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

interface HistoryEntry {
  id: string;
  sessionId: string;
  createdAt: string;
  mode: ModeId;
  context: ContextId;
  issue: string;
  actionId: ActionId;
  actionLabel: string;
  commitment: Commitment;
  status: Status;
}

const HISTORY_KEY = "ritual_reset_history";
const HISTORY_MIGRATION_KEYS = [HISTORY_KEY, "reset_history", "past_resets", "entries"];
const SESSION_KEY = "ritual_reset_session_id";

const MODE_OPTIONS: ChoiceOption<ModeId>[] = [
  { id: "clarity", label: "I need clarity", hint: "Name the knot." },
  { id: "steadiness", label: "I need steadiness", hint: "Get my footing back." },
  { id: "courage", label: "I need courage", hint: "Face the avoided thing." },
  { id: "reentry", label: "I need to re-enter", hint: "Come back from the scroll." },
];

const CONTEXT_OPTIONS: Record<ModeId, ChoiceOption<ContextId>[]> = {
  clarity: [
    { id: "overthinking", label: "I’m overthinking" },
    { id: "cant_start", label: "I don’t know where to start" },
    { id: "scattered", label: "My mind feels noisy" },
    { id: "stuck_between", label: "I’m stuck between options" },
  ],
  steadiness: [
    { id: "scattered", label: "I feel scattered" },
    { id: "heavy", label: "I feel heavy / drained" },
    { id: "pulled_to_phone", label: "My phone keeps pulling me" },
    { id: "need_calm", label: "I need to calm down first" },
  ],
  courage: [
    { id: "avoiding_message", label: "I’m avoiding a message" },
    { id: "avoiding_task", label: "I’m avoiding a task" },
    { id: "fear_of_wrong", label: "I’m afraid of getting it wrong" },
    { id: "waiting_ready", label: "I’m waiting to feel ready" },
  ],
  reentry: [
    { id: "drifted_scroll", label: "I drifted into scrolling" },
    { id: "lost_thread", label: "I lost the thread" },
    { id: "interrupted", label: "I got interrupted" },
    { id: "cant_start", label: "I still can’t restart" },
  ],
};

const ACTION_OPTIONS: ChoiceOption<ActionId>[] = [
  { id: "two_min", label: "I don’t know — just start 2 minutes" },
  { id: "open_file", label: "Open the file / notes" },
  { id: "reply_line", label: "Reply with one clear line" },
  { id: "five_breaths", label: "Stand up and take 5 breaths" },
  { id: "wudu_return", label: "Make wudu and return" },
  { id: "close_tabs", label: "Close extra tabs and start" },
  { id: "custom", label: "Write my own" },
];

const ISSUE_PLACEHOLDERS: Record<ModeId, string> = {
  clarity: "…I’m avoiding starting because it might go wrong.",
  steadiness: "…I feel pulled in too many directions and need one stable move.",
  courage: "…I know what to do, but I’m avoiding the discomfort.",
  reentry: "…I slipped into noise and now I need to restart simply.",
};

const MODE_LABEL: Record<ModeId, string> = Object.fromEntries(
  MODE_OPTIONS.map((m) => [m.id, m.label])
) as Record<ModeId, string>;

const CONTEXT_LABEL: Record<ContextId, string> = Object.fromEntries(
  Object.values(CONTEXT_OPTIONS)
    .flat()
    .map((c) => [c.id, c.label])
) as Record<ContextId, string>;

const ACTION_LABEL: Record<ActionId, string> = Object.fromEntries(
  ACTION_OPTIONS.map((a) => [a.id, a.label])
) as Record<ActionId, string>;

function safeJsonParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  const found = window.localStorage.getItem(SESSION_KEY);
  if (found) return found;

  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];

  for (const key of HISTORY_MIGRATION_KEYS) {
    const raw = safeJsonParse(window.localStorage.getItem(key));
    if (Array.isArray(raw)) {
      const normalized = raw
        .map((item: any): HistoryEntry | null => {
          if (!item) return null;

          const mode = item.mode as ModeId;
          const context = item.context as ContextId;
          const actionId = (item.actionId || item.action || "custom") as ActionId;

          return {
            id: String(item.id || `${Date.now()}-${Math.random()}`),
            sessionId: String(item.sessionId || getOrCreateSessionId()),
            createdAt: String(item.createdAt || new Date().toISOString()),
            mode,
            context,
            issue: String(item.issue || item.answer || item.problem || ""),
            actionId,
            actionLabel: String(
              item.actionLabel || ACTION_LABEL[actionId] || item.action || "Custom action"
            ),
            commitment: item.commitment === "later" ? "later" : "now",
            status:
              item.status === "done" || item.status === "not_yet" ? item.status : "pending",
          };
        })
        .filter(Boolean) as HistoryEntry[];

      return normalized;
    }
  }

  return [];
}

function persistHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function fireEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const App: React.FC = () => {
  const [view, setView] = useState<View>("reset");
  const [step, setStep] = useState<Step>(1);
  const [sessionId, setSessionId] = useState<string>("server");

  const [mode, setMode] = useState<ModeId | null>(null);
  const [context, setContext] = useState<ContextId | null>(null);
  const [issue, setIssue] = useState("");
  const [actionId, setActionId] = useState<ActionId | null>(null);
  const [customAction, setCustomAction] = useState("");
  const [commitment, setCommitment] = useState<Commitment>("now");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    setHistory(readHistory());
  }, []);

  const contextOptions = useMemo(() => (mode ? CONTEXT_OPTIONS[mode] : []), [mode]);

  const activeActionLabel =
    actionId === "custom" ? customAction.trim() : actionId ? ACTION_LABEL[actionId] : "";

  const latestEntry = useMemo(
    () => history.find((entry) => entry.id === latestId) || null,
    [history, latestId]
  );

  function resetFlow() {
    setStep(1);
    setMode(null);
    setContext(null);
    setIssue("");
    setActionId(null);
    setCustomAction("");
    setCommitment("now");
    setLatestId(null);
  }

  function handleModeSelect(selected: ModeId) {
    setMode(selected);

    fireEvent("quick_reset_used", {
      session_id: sessionId,
      mode: selected,
    });

    fireEvent("mode_selected", {
      session_id: sessionId,
      mode: selected,
    });

    setTimeout(() => setStep(2), 120);
  }

  function handleContextSelect(selected: ContextId) {
    setContext(selected);

    fireEvent("state_selected", {
      session_id: sessionId,
      mode,
      state: selected,
    });

    setTimeout(() => setStep(3), 120);
  }

  function handleIssueContinue() {
    if (!issue.trim()) return;
    setStep(4);
  }

  function handleSaveReset() {
    if (!mode || !context || !issue.trim() || !actionId) return;

    const label = activeActionLabel.trim();
    if (!label) return;

    fireEvent("action_selected", {
      session_id: sessionId,
      mode,
      state: context,
      action: actionId,
      commitment,
    });

    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      sessionId,
      createdAt: new Date().toISOString(),
      mode,
      context,
      issue: issue.trim(),
      actionId,
      actionLabel: label,
      commitment,
      status: "pending",
    };

    const nextHistory = [entry, ...history].slice(0, 100);
    setHistory(nextHistory);
    persistHistory(nextHistory);
    setLatestId(entry.id);
    setStep(5);

    fireEvent("reset_completed", {
      session_id: sessionId,
      mode,
      state: context,
      action: actionId,
      commitment,
    });
  }

  function updateStatus(id: string, status: Status) {
    const nextHistory = history.map((item) => (item.id === id ? { ...item, status } : item));
    setHistory(nextHistory);
    persistHistory(nextHistory);

    fireEvent("status_changed", {
      session_id: sessionId,
      local_id: id,
      status,
    });
  }

  function openHistory() {
    setView("history");
    fireEvent("past_resets_viewed", { session_id: sessionId });
  }

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <>
      <style>{`
        :root {
          --bg: #0a0a0c;
          --card: rgba(255,255,255,0.05);
          --card-strong: rgba(255,255,255,0.08);
          --line: rgba(234, 227, 214, 0.12);
          --text: #ebe4d8;
          --muted: #b9b0a2;
          --gold: #b29062;
          --gold-soft: rgba(178, 144, 98, 0.17);
          --success: #7fb58b;
          --warning: #c39d5e;
          --shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top left, rgba(178, 144, 98, 0.18), transparent 34%),
            radial-gradient(circle at bottom right, rgba(123, 181, 139, 0.08), transparent 28%),
            linear-gradient(180deg, #09090b 0%, #0d0d10 52%, #09090b 100%);
          color: var(--text);
        }

        .app-shell {
          min-height: 100vh;
          padding: 24px 16px 72px;
        }

        .app-frame {
          width: min(100%, 720px);
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .mark {
          letter-spacing: 0.24em;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted);
        }

        .nav {
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(14px);
        }

        .nav button {
          border: 0;
          background: transparent;
          color: var(--muted);
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }

        .nav button.active {
          background: var(--card-strong);
          color: var(--text);
        }

        .panel {
          position: relative;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border-radius: 32px;
          padding: 28px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(22px);
          overflow: hidden;
        }

        .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(178, 144, 98, 0.06), transparent 38%);
          pointer-events: none;
        }

        .eyebrow {
          color: var(--muted);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .date-line {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 8px;
        }

        h1, h2 {
          font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
          font-weight: 600;
          line-height: 1.02;
          margin: 0;
          letter-spacing: -0.02em;
        }

        h1 {
          font-size: clamp(2.2rem, 8vw, 4rem);
          margin-bottom: 14px;
        }

        h2 {
          font-size: clamp(1.6rem, 5vw, 2.5rem);
          margin-bottom: 12px;
        }

        .lede, .helper, .muted {
          color: var(--muted);
          line-height: 1.6;
          max-width: 58ch;
        }

        .lede {
          font-size: 1rem;
          margin-bottom: 22px;
        }

        .helper {
          font-size: 0.95rem;
          margin-top: 12px;
        }

        .grid {
          display: grid;
          gap: 12px;
        }

        .grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .choice {
          width: 100%;
          text-align: left;
          border-radius: 20px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
          color: var(--text);
          padding: 16px 16px 15px;
          cursor: pointer;
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }

        .choice:hover {
          transform: translateY(-1px);
          border-color: rgba(178, 144, 98, 0.4);
        }

        .choice.active {
          border-color: rgba(178, 144, 98, 0.55);
          background: var(--gold-soft);
        }

        .choice-title {
          font-weight: 600;
        }

        .choice-hint {
          margin-top: 6px;
          font-size: 0.88rem;
          color: var(--muted);
        }

        .field-wrap {
          margin-top: 8px;
          padding: 18px 18px 12px;
          border-radius: 22px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
        }

        .field-label {
          display: block;
          color: var(--muted);
          font-size: 0.84rem;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .text-input {
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(234, 227, 214, 0.14);
          color: var(--text);
          font-size: 1.06rem;
          padding: 8px 0 12px;
          outline: none;
        }

        .text-input::placeholder {
          color: rgba(185, 176, 162, 0.55);
        }

        .step-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          border: 1px solid var(--line);
          padding: 8px 12px;
          font-size: 0.82rem;
          color: var(--muted);
          background: rgba(255,255,255,0.03);
        }

        .cta {
          margin-top: 24px;
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 15px 18px;
          font-size: 0.98rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #0b0b0d;
          background: linear-gradient(180deg, #d7bf95, #b29062);
          cursor: pointer;
          box-shadow: 0 18px 40px rgba(178, 144, 98, 0.18);
        }

        .cta:disabled {
          cursor: not-allowed;
          opacity: 0.45;
          box-shadow: none;
        }

        .sub-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .pill {
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
          color: var(--muted);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 0.92rem;
          cursor: pointer;
        }

        .pill.active {
          color: var(--text);
          border-color: rgba(178, 144, 98, 0.55);
          background: var(--gold-soft);
        }

        .summary-card, .history-card {
          border-radius: 22px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.04);
          padding: 18px;
        }

        .summary-card {
          margin-top: 20px;
        }

        .summary-label {
          color: var(--muted);
          font-size: 0.8rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .summary-value {
          font-family: "Iowan Old Style", Georgia, serif;
          font-size: 1.35rem;
          line-height: 1.25;
        }

        .tiny {
          font-size: 0.86rem;
          color: var(--muted);
          line-height: 1.55;
        }

        .history-list {
          display: grid;
          gap: 14px;
        }

        .history-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .status-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .status-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 0.82rem;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
          color: var(--muted);
        }

        .status-tag.done {
          color: var(--success);
          border-color: rgba(127,181,139,0.3);
        }

        .status-tag.not_yet {
          color: var(--warning);
          border-color: rgba(195,157,94,0.28);
        }

        .linkish {
          border: 0;
          background: transparent;
          color: var(--muted);
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          font-size: 0.92rem;
        }

        .empty {
          padding: 30px 18px;
          border-radius: 22px;
          border: 1px dashed var(--line);
          color: var(--muted);
          text-align: center;
        }

        @media (max-width: 640px) {
          .panel {
            padding: 22px;
            border-radius: 28px;
          }

          .grid.two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="app-shell">
        <div className="app-frame">
          <div className="topbar">
            <div>
              <div className="mark">Reset</div>
            </div>

            <div className="nav" aria-label="Main navigation">
              <button
                className={view === "reset" ? "active" : ""}
                onClick={() => setView("reset")}
              >
                Reset
              </button>
              <button
                className={view === "history" ? "active" : ""}
                onClick={openHistory}
              >
                History
              </button>
            </div>
          </div>

          {view === "reset" && (
            <section className="panel">
              {step === 1 && (
                <>
                  <div className="eyebrow">30 second reset</div>
                  <div className="date-line">{todayLabel}</div>
                  <h1>Pause. Choose the kind of reset you need.</h1>
                  <p className="lede">
                    One honest minute. One next move. No journaling marathon. No perfect answer.
                  </p>

                  <div className="grid two">
                    {MODE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice ${mode === option.id ? "active" : ""}`}
                        onClick={() => handleModeSelect(option.id)}
                      >
                        <div className="choice-title">{option.label}</div>
                        {option.hint ? <div className="choice-hint">{option.hint}</div> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && mode && (
                <>
                  <div className="step-row">
                    <div className="step-badge">Step 2 / 4</div>
                    <button className="linkish" onClick={resetFlow}>
                      Start over
                    </button>
                  </div>

                  <h2>What feels most true right now?</h2>
                  <p className="lede">Pick what fits.</p>

                  <div className="grid two">
                    {contextOptions.map((option) => (
                      <button
                        key={option.id}
                        className={`choice ${context === option.id ? "active" : ""}`}
                        onClick={() => handleContextSelect(option.id)}
                      >
                        <div className="choice-title">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && mode && context && (
                <>
                  <div className="step-row">
                    <div className="step-badge">Step 3 / 4</div>
                    <button className="linkish" onClick={() => setStep(2)}>
                      Back
                    </button>
                  </div>

                  <h2>Finish this sentence.</h2>
                  <p className="lede">If I’m honest, this is about…</p>

                  <div className="field-wrap">
                    <label className="field-label" htmlFor="issue-input">
                      One line only
                    </label>
                    <input
                      id="issue-input"
                      className="text-input"
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      placeholder={ISSUE_PLACEHOLDERS[mode]}
                      maxLength={160}
                    />
                  </div>

                  <p className="helper">Plain language beats smart language.</p>

                  <button className="cta" onClick={handleIssueContinue} disabled={!issue.trim()}>
                    Continue
                  </button>
                </>
              )}

              {step === 4 && mode && context && (
                <>
                  <div className="step-row">
                    <div className="step-badge">Step 4 / 4</div>
                    <button className="linkish" onClick={() => setStep(3)}>
                      Back
                    </button>
                  </div>

                  <h2>Choose the smallest right move.</h2>
                  <p className="lede">Small is the point. Movement first, meaning second.</p>

                  <div className="grid two">
                    {ACTION_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`choice ${actionId === option.id ? "active" : ""}`}
                        onClick={() => setActionId(option.id)}
                      >
                        <div className="choice-title">{option.label}</div>
                      </button>
                    ))}
                  </div>

                  {actionId === "custom" && (
                    <div className="field-wrap" style={{ marginTop: 16 }}>
                      <label className="field-label" htmlFor="custom-action">
                        Write your own next move
                      </label>
                      <input
                        id="custom-action"
                        className="text-input"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        placeholder="…open the draft and write the first ugly sentence."
                        maxLength={120}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 20 }}>
                    <div className="field-label">When?</div>
                    <div className="sub-actions">
                      <button
                        className={`pill ${commitment === "now" ? "active" : ""}`}
                        onClick={() => setCommitment("now")}
                      >
                        Now
                      </button>
                      <button
                        className={`pill ${commitment === "later" ? "active" : ""}`}
                        onClick={() => setCommitment("later")}
                      >
                        In 10 minutes
                      </button>
                    </div>
                  </div>

                  <button
                    className="cta"
                    onClick={handleSaveReset}
                    disabled={
                      !mode ||
                      !context ||
                      !issue.trim() ||
                      !actionId ||
                      (actionId === "custom" && !customAction.trim())
                    }
                  >
                    Commit to this
                  </button>
                </>
              )}

              {step === 5 && latestEntry && (
                <>
                  <div className="eyebrow">Your next move</div>
                  <h2>{latestEntry.actionLabel}</h2>

                  <p className="lede">
                    {latestEntry.commitment === "now"
                      ? "Do it now — before your brain escapes."
                      : "Good. Keep it alive. Come back and do exactly this."}
                  </p>

                  <div className="summary-card">
                    <div className="summary-label">What you named</div>
                    <div className="summary-value">{latestEntry.issue}</div>
                    <p className="tiny" style={{ marginTop: 14 }}>
                      {MODE_LABEL[latestEntry.mode]} · {CONTEXT_LABEL[latestEntry.context]}
                    </p>
                  </div>

                  <div className="status-row">
                    <button className="pill" onClick={() => updateStatus(latestEntry.id, "done")}>
                      Mark done
                    </button>
                    <button
                      className="pill"
                      onClick={() => updateStatus(latestEntry.id, "not_yet")}
                    >
                      Not yet
                    </button>
                    <button className="pill" onClick={resetFlow}>
                      Do another reset
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {view === "history" && (
            <section className="panel">
              <div className="history-top">
                <div>
                  <div className="eyebrow">History</div>
                  <h2>Previous resets</h2>
                </div>
                <button className="pill" onClick={() => setView("reset")}>
                  New reset
                </button>
              </div>

              {history.length === 0 ? (
                <div className="empty">
                  No resets saved yet. Your completed resets will appear here.
                </div>
              ) : (
                <div className="history-list">
                  {history.map((entry) => (
                    <article key={entry.id} className="history-card">
                      <div className="history-top" style={{ marginBottom: 10 }}>
                        <div className="summary-label" style={{ marginBottom: 0 }}>
                          {formatDate(entry.createdAt)}
                        </div>
                        <div className={`status-tag ${entry.status}`}>
                          {entry.status === "pending"
                            ? "pending"
                            : entry.status === "done"
                            ? "done"
                            : "not yet"}
                        </div>
                      </div>

                      <div className="summary-value" style={{ fontSize: "1.2rem" }}>
                        {entry.issue}
                      </div>

                      <p className="tiny" style={{ marginTop: 10 }}>
                        {MODE_LABEL[entry.mode]} · {CONTEXT_LABEL[entry.context]}
                      </p>

                      <div className="summary-card" style={{ marginTop: 14 }}>
                        <div className="summary-label">Smallest move</div>
                        <div style={{ fontWeight: 700 }}>{entry.actionLabel}</div>
                        <p className="tiny" style={{ marginTop: 8 }}>
                          Commitment: {entry.commitment === "now" ? "Now" : "In 10 minutes"}
                        </p>
                      </div>

                      <div className="status-row">
                        <button className="pill" onClick={() => updateStatus(entry.id, "done")}>
                          Done
                        </button>
                        <button
                          className="pill"
                          onClick={() => updateStatus(entry.id, "not_yet")}
                        >
                          Not yet
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default App;

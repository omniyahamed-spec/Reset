import { CSSProperties, useEffect, useState } from "react";
import {
  BLOCKERS,
  CHECKOUT_HOUR,
  DayLog,
  DayOutcome,
  EVENING_DEFAULT,
  FIRST_MOVE_SUGGESTIONS,
  closedStreak,
  dayInsight,
  dayKey,
  emptyDay,
  shiftDay,
  weekCells,
} from "./daily";

const C = {
  ink: "#1D2B30",
  sub: "#4F6067",
  muted: "#5F7076",
  line: "#E3ECEC",
  line2: "#D8E3E3",
  brand: "#3B6B70",
  soft: "#E3EFEF",
  partly: "#A9C7C5",
};

const st: Record<string, CSSProperties> = {
  card: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 20, padding: 20, marginBottom: 12 },
  pill: {
    display: "inline-block", border: `1px solid ${C.line2}`, borderRadius: 999, padding: "5px 12px",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 14,
  },
  title: { fontSize: 22, lineHeight: 1.25, fontWeight: 700, color: C.ink, marginBottom: 6, letterSpacing: "-0.01em" },
  sub: { fontSize: 15, color: C.sub, lineHeight: 1.5, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 6 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 14, border: `1px solid ${C.line2}`,
    fontSize: 16, fontFamily: "inherit", color: C.ink, background: "#fff", marginBottom: 10, outline: "none",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.line2}`, background: "#fff",
    fontSize: 13, cursor: "pointer", color: C.ink, fontFamily: "inherit",
  },
  chipOn: { background: C.soft, borderColor: C.brand },
  cta: {
    width: "100%", minHeight: 48, borderRadius: 999, border: "none", background: C.brand, color: "#fff",
    fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
  },
  ghost: {
    width: "100%", minHeight: 44, borderRadius: 999, border: `1px solid ${C.line2}`, background: "#fff",
    color: C.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
  },
  disabled: { opacity: 0.4, cursor: "default" },
  big: { fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.3, margin: "4px 0 12px" },
  row: { display: "flex", gap: 8 },
};

function WeekStrip({ days }: { days: Record<string, DayLog> }) {
  const cells = weekCells(days);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0 14px" }}>
      {cells.map((c) => {
        const fill =
          c.state === "moved" ? C.brand : c.state === "partly" ? C.partly : "transparent";
        const border =
          c.state === "none" ? C.line2 : c.state === "open" ? C.partly : C.brand;
        return (
          <div key={c.day} style={{ textAlign: "center", fontSize: 11, color: C.muted, width: 32 }}>
            <div
              aria-label={`${c.day}: ${c.state}`}
              style={{
                width: 22, height: 22, borderRadius: "50%", margin: "0 auto 4px",
                background: fill, border: `2px ${c.state === "open" ? "dashed" : "solid"} ${border}`,
                boxShadow: c.isToday ? `0 0 0 3px ${C.soft}` : "none",
              }}
            />
            {c.label}
          </div>
        );
      })}
    </div>
  );
}

// ── HOME CARD: today's one thing + the next action ───────────────────────
export function TodayCard({
  days,
  onCheckin,
  onCheckout,
  onSprint,
  onResetOnIt,
}: {
  days: Record<string, DayLog>;
  onCheckin: () => void;
  onCheckout: () => void;
  onSprint: () => void;
  onResetOnIt: (thing: string) => void;
}) {
  const today = days[dayKey()];
  const evening = new Date().getHours() >= CHECKOUT_HOUR;
  const streak = closedStreak(days);

  if (today?.checkoutAt) {
    return (
      <div style={st.card}>
        <div style={st.label}>Today · closed</div>
        <div style={st.big}>{today.oneThing || "Day closed"}</div>
        <WeekStrip days={days} />
        <div style={{ ...st.sub, marginBottom: 0 }}>
          {today.tomorrow ? `Tomorrow: ${today.tomorrow}` : "Rest. Tomorrow starts with one thing."}
        </div>
      </div>
    );
  }

  if (!today?.checkinAt) {
    return (
      <div style={st.card}>
        <div style={st.label}>Today</div>
        <div style={st.big}>
          {evening ? "Close today, set up tomorrow." : "What's the one thing that matters today?"}
        </div>
        <button style={st.cta} onClick={evening ? onCheckout : onCheckin}>
          {evening ? "Close the day · 10 sec" : "Check in · 20 sec"}
        </button>
        {streak > 0 && (
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {streak} day{streak === 1 ? "" : "s"} closed in a row
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={st.card}>
      <div style={st.label}>Today's one thing</div>
      <div style={st.big}>{today.oneThing}</div>
      <WeekStrip days={days} />
      {evening ? (
        <>
          <button style={st.cta} onClick={onCheckout}>Close the day · 10 sec</button>
          <button style={st.ghost} onClick={() => onResetOnIt(today.oneThing)}>Stuck on it? Reset</button>
        </>
      ) : (
        <>
          {!today.sprintDone && today.firstMove ? (
            <button style={st.cta} onClick={onSprint}>Start 2 min: {today.firstMove}</button>
          ) : null}
          <button style={today.sprintDone || !today.firstMove ? st.cta : st.ghost} onClick={() => onResetOnIt(today.oneThing)}>
            Stuck on it? Reset
          </button>
          <button style={{ ...st.ghost, border: "none", color: C.muted, fontSize: 14 }} onClick={onCheckout}>
            Done already? Close the day
          </button>
        </>
      )}
    </div>
  );
}

// ── MORNING CHECK-IN ─────────────────────────────────────────────────────
export function CheckinScreen({
  days,
  energy,
  onSave,
  onSkip,
}: {
  days: Record<string, DayLog>;
  energy: number | null;
  onSave: (d: DayLog, startSprint: boolean) => void;
  onSkip: () => void;
}) {
  const key = dayKey();
  const yesterday = days[shiftDay(key, -1)];
  const planned = yesterday?.tomorrow || "";
  const carry =
    yesterday && yesterday.outcome && yesterday.outcome !== "yes" && yesterday.oneThing
      ? yesterday.oneThing
      : "";
  const [thing, setThing] = useState(days[key]?.oneThing || planned);
  const [firstMove, setFirstMove] = useState(days[key]?.firstMove || "");
  const ok = thing.trim().length > 0;

  function save(startSprint: boolean) {
    if (!ok) return;
    const base = days[key] || emptyDay(key);
    onSave(
      {
        ...base,
        oneThing: thing.trim(),
        firstMove: firstMove.trim() || "Open it",
        energy: energy ?? base.energy,
        checkinAt: base.checkinAt || new Date().toISOString(),
      },
      startSprint
    );
  }

  return (
    <div style={st.card}>
      <div style={st.pill}>Check in</div>
      <div style={st.title}>One thing that matters today.</div>
      <div style={st.sub}>Not a to-do list. The one that would make today count.</div>
      <input
        style={st.input}
        autoFocus
        maxLength={80}
        placeholder={planned || "e.g. Send the proposal"}
        value={thing}
        onChange={(e) => setThing(e.target.value)}
      />
      {(planned || carry) && (
        <div style={st.chips}>
          {planned && planned !== thing && (
            <button style={st.chip} onClick={() => setThing(planned)}>Planned last night: {planned}</button>
          )}
          {carry && carry !== thing && carry !== planned && (
            <button style={st.chip} onClick={() => setThing(carry)}>Carry over: {carry}</button>
          )}
        </div>
      )}
      <div style={{ ...st.label, marginTop: 6 }}>First 2-minute move</div>
      <div style={st.chips}>
        {FIRST_MOVE_SUGGESTIONS.map((s) => (
          <button
            key={s}
            style={{ ...st.chip, ...(firstMove === s ? st.chipOn : {}) }}
            onClick={() => setFirstMove(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <button style={{ ...st.cta, ...(ok ? {} : st.disabled) }} disabled={!ok} onClick={() => save(true)}>
        Start the 2 minutes now
      </button>
      <button style={{ ...st.ghost, ...(ok ? {} : st.disabled) }} disabled={!ok} onClick={() => save(false)}>
        Save, I'll start later
      </button>
      <button style={{ ...st.ghost, border: "none", color: C.muted, fontSize: 14 }} onClick={onSkip}>
        Skip today
      </button>
    </div>
  );
}

// ── 2-MINUTE SPRINT: instant value, the user is moving within a minute ───
const SPRINT_MS = 2 * 60 * 1000;
export function SprintScreen({
  day,
  onFinish,
  onCancel,
}: {
  day: DayLog;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const [endAt] = useState(() => Date.now() + SPRINT_MS);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, endAt - now);
  const done = left === 0;
  const pct = 100 - (100 * left) / SPRINT_MS;
  const secs = Math.ceil(left / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;

  return (
    <div style={{ ...st.card, textAlign: "center" }}>
      <div style={st.pill}>2 minutes</div>
      <div style={{ ...st.sub, marginBottom: 4 }}>{day.oneThing}</div>
      <div style={{ ...st.title, fontSize: 24, marginBottom: 18 }}>{day.firstMove}</div>
      <div
        style={{
          width: 180, height: 180, borderRadius: "50%", margin: "0 auto 18px",
          background: `conic-gradient(${C.brand} ${pct}%, ${C.soft} ${pct}%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 150, height: 150, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums",
          }}
        >
          {done ? "✓" : `${mm}:${String(ss).padStart(2, "0")}`}
        </div>
      </div>
      {done ? (
        <>
          <div style={st.big}>You started. That was the hard part.</div>
          <button style={st.cta} onClick={onFinish}>Keep going</button>
        </>
      ) : (
        <>
          <div style={{ ...st.sub, fontSize: 14 }}>Only this. Nothing else for 2 minutes.</div>
          <button style={st.ghost} onClick={onFinish}>Done already</button>
          <button style={{ ...st.ghost, border: "none", color: C.muted, fontSize: 14 }} onClick={onCancel}>
            Not now
          </button>
        </>
      )}
    </div>
  );
}

// ── EVENING CHECK-OUT ─────────────────────────────────────────────────────
export function CloseDayScreen({
  days,
  onSave,
  onCancel,
}: {
  days: Record<string, DayLog>;
  onSave: (d: DayLog) => void;
  onCancel: () => void;
}) {
  const key = dayKey();
  const base = days[key] || emptyDay(key);
  const [thing, setThing] = useState(base.oneThing);
  const [outcome, setOutcome] = useState<DayOutcome | null>(base.outcome);
  const [blocker, setBlocker] = useState<string | null>(base.blocker);
  const [tomorrow, setTomorrow] = useState(base.tomorrow);
  const needsThing = !base.oneThing;
  const ok = !!outcome && (!needsThing || thing.trim().length > 0) && (outcome === "yes" || !!blocker);

  function pick(o: DayOutcome) {
    setOutcome(o);
    if (o === "yes") setBlocker(null);
    if (o !== "yes" && !tomorrow && (thing || base.oneThing)) setTomorrow(thing || base.oneThing);
  }

  return (
    <div style={st.card}>
      <div style={st.pill}>Close the day</div>
      {needsThing ? (
        <>
          <div style={st.title}>What mattered most today?</div>
          <input
            style={st.input}
            maxLength={80}
            placeholder="The one thing"
            value={thing}
            onChange={(e) => setThing(e.target.value)}
          />
        </>
      ) : (
        <>
          <div style={st.title}>Did it move?</div>
          <div style={st.big}>{base.oneThing}</div>
        </>
      )}
      <div style={{ ...st.row, marginBottom: 14 }}>
        {(["yes", "partly", "no"] as DayOutcome[]).map((o) => (
          <button
            key={o}
            style={{ ...st.ghost, marginBottom: 0, ...(outcome === o ? { ...st.chipOn, borderWidth: 2 } : {}) }}
            onClick={() => pick(o)}
          >
            {o === "yes" ? "Yes" : o === "partly" ? "Partly" : "No"}
          </button>
        ))}
      </div>
      {outcome && outcome !== "yes" && (
        <>
          <div style={st.label}>What got in the way?</div>
          <div style={st.chips}>
            {BLOCKERS.map((b) => (
              <button
                key={b}
                style={{ ...st.chip, ...(blocker === b ? st.chipOn : {}) }}
                onClick={() => setBlocker(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </>
      )}
      {outcome && (
        <>
          <div style={st.label}>Tomorrow's one thing (optional)</div>
          <input
            style={st.input}
            maxLength={80}
            placeholder="Decide it now, start faster tomorrow"
            value={tomorrow}
            onChange={(e) => setTomorrow(e.target.value)}
          />
        </>
      )}
      <button
        style={{ ...st.cta, ...(ok ? {} : st.disabled) }}
        disabled={!ok}
        onClick={() =>
          onSave({
            ...base,
            oneThing: base.oneThing || thing.trim(),
            outcome,
            blocker: outcome === "yes" ? null : blocker,
            tomorrow: tomorrow.trim(),
            checkoutAt: new Date().toISOString(),
          })
        }
      >
        Close the day
      </button>
      <button style={{ ...st.ghost, border: "none", color: C.muted, fontSize: 14 }} onClick={onCancel}>
        Not now
      </button>
    </div>
  );
}

// ── DAY CLOSED: reward + pattern + habit hook ────────────────────────────
export function DayClosedScreen({
  days,
  showReminderOffer,
  morning,
  onReminderAdded,
  icsUrl,
  googleMorningUrl,
  googleEveningUrl,
  onHome,
}: {
  days: Record<string, DayLog>;
  showReminderOffer: boolean;
  morning: { h: number; m: number };
  onReminderAdded: () => void;
  icsUrl: string;
  googleMorningUrl: string;
  googleEveningUrl: string;
  onHome: () => void;
}) {
  const today = days[dayKey()];
  const streak = closedStreak(days);
  const p = (n: number) => String(n).padStart(2, "0");
  const linkStyle: CSSProperties = {
    ...st.ghost, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginBottom: 0,
  };
  const headline =
    today?.outcome === "yes"
      ? "It moved. Day closed."
      : today?.outcome === "partly"
      ? "Partly is still forward. Day closed."
      : "Honest beats perfect. Day closed.";

  return (
    <>
      <div style={st.card}>
        <div style={st.pill}>Day closed</div>
        <div style={st.title}>{headline}</div>
        <WeekStrip days={days} />
        <div style={{ ...st.sub, marginBottom: 6 }}>
          {streak} day{streak === 1 ? "" : "s"} closed in a row.
        </div>
        <div style={{ ...st.sub, color: C.ink, fontWeight: 600 }}>{dayInsight(days)}</div>
        {today?.tomorrow && (
          <div style={{ ...st.sub, marginBottom: 0 }}>Tomorrow is ready: {today.tomorrow}</div>
        )}
      </div>
      {showReminderOffer && (
        <div style={st.card}>
          <div style={st.label}>Make it automatic</div>
          <div style={{ ...st.sub }}>
            Two calendar nudges: check in at {p(morning.h)}:{p(morning.m)}, close the day at{" "}
            {p(EVENING_DEFAULT.h)}:{p(EVENING_DEFAULT.m)}. Each opens Reset straight to the right screen.
          </div>
          <a href={icsUrl} onClick={onReminderAdded} style={{ ...linkStyle, marginBottom: 8 }}>
            iPhone / Outlook (both)
          </a>
          <div style={st.row}>
            <a href={googleMorningUrl} target="_blank" rel="noopener noreferrer" onClick={onReminderAdded} style={linkStyle}>
              Google: morning
            </a>
            <a href={googleEveningUrl} target="_blank" rel="noopener noreferrer" onClick={onReminderAdded} style={linkStyle}>
              Google: evening
            </a>
          </div>
        </div>
      )}
      <button style={st.cta} onClick={onHome}>Done</button>
    </>
  );
}

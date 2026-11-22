import { useState } from "react";

// One reset step = one tap. A chip answers AND moves on.
// Typing is the exception, behind "Type my own".
// Chips the user picked before (learned from their history) come first.

export const MIND_OPTIONS = ["Work", "A person", "Money", "Health", "A decision", "Everything"];
export const AVOID_OPTIONS = ["Starting", "A message", "A call", "A decision", "A hard task", "Resting"];
export const MOVE_OPTIONS = ["Open it", "Send it", "2 min on it", "Write 1 line", "Make the call", "Step away 5 min"];

/** Up to 2 of the user's own past answers (used 2+ times) that aren't already chips, most used first. */
export function learnedOptions(past: string[], defaults: string[]): string[] {
  const counts: Record<string, number> = {};
  past.forEach((p) => {
    const v = (p || "").trim();
    if (v && !defaults.includes(v) && v.length <= 40) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, n]) => n >= 2) // "often" = picked at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([v]) => v);
}

const C = { ink: "#1D2B30", sub: "#4F6067", muted: "#5F7076", line: "#D8E3E3", brand: "#3B6B70", soft: "#E3EFEF" };

export function TapStep({
  step,
  title,
  sub,
  context,
  options,
  learned,
  value,
  placeholder,
  onPick,
  onBack,
  backLabel = "← Back",
}: {
  step: 1 | 2 | 3;
  title: string;
  sub: string;
  context?: string;
  options: string[];
  learned: string[];
  value: string;
  placeholder: string;
  onPick: (v: string) => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const all = [...learned, ...options.filter((o) => !learned.includes(o))];
  if (value && !all.includes(value)) all.unshift(value);

  return (
    <div style={{ background: "#fff", border: "1px solid #E3ECEC", borderRadius: 20, padding: 20, marginBottom: 12 }}>
      <div style={{ height: 3, background: "#E3ECEC", borderRadius: 999, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ width: `${step * 33.4}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
        {step} of 3 · one tap
      </div>
      <div style={{ fontSize: 22, lineHeight: 1.25, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, color: C.sub, marginBottom: context ? 8 : 16 }}>{sub}</div>
      {context && (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{context}</div>
      )}

      {!typing ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {all.map((opt) => {
              const isLearned = learned.includes(opt);
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onPick(opt)}
                  style={{
                    minHeight: 52,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `${selected ? 2 : 1}px solid ${selected ? C.brand : C.line}`,
                    background: selected || isLearned ? C.soft : "#fff",
                    color: C.ink,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {opt}
                  {isLearned && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginTop: 2 }}>you often pick this</div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setTyping(true)}
            style={{ background: "none", border: "none", color: C.brand, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}
          >
            Type my own
          </button>
        </>
      ) : (
        <>
          <input
            autoFocus
            maxLength={80}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draft.trim() && onPick(draft.trim())}
            style={{
              width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 14, border: `1px solid ${C.line}`,
              fontSize: 16, fontFamily: "inherit", color: C.ink, marginBottom: 10, outline: "none",
            }}
          />
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={() => onPick(draft.trim())}
            style={{
              width: "100%", minHeight: 48, borderRadius: 999, border: "none", background: C.brand, color: "#fff",
              fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 8, opacity: draft.trim() ? 1 : 0.4,
            }}
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setTyping(false)}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}
          >
            Back to options
          </button>
        </>
      )}
      <div>
        <button
          type="button"
          onClick={onBack}
          style={{ background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", padding: "10px 0 0", fontFamily: "inherit" }}
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
}

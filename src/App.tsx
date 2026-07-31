import React, { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================================
   RESET v3 — the noise between knowing and doing
   ----------------------------------------------------------------------------
   Flow:  BREATHE → CLEAR (one input) → MOVE (suggested, editable) → COMMIT →
          EVIDENCE → "clear the next noise" (capped loop)

   Merged design decisions:
   • ONE required entry: "What are you avoiding?"  (from the redesign doc)
   • Deterministic avoidance→move engine, editable, offline-instant, AI-ready
   • Big breathing orb, ~5s in / ~5s out, color travels calm→action
   • Reward = Action Evidence (identity), praise line is VARIABLE (dopamine)
   • Loop is capped: momentum, not an infinite feed
   • One integrity check (5s "still true?") so evidence isn't pure fiction
============================================================================ */

const C = {
  ink: "#0B1020",
  calm: "#3DD9C4",     // teal — clarity
  cool: "#6C7BFF",     // indigo — thought
  energy: "#FFB23E",   // amber — action
  energyHot: "#FF7A45",// coral — commit
  text: "#EAF0FF",
  textDim: "rgba(234,240,255,0.58)",
  textFaint: "rgba(234,240,255,0.34)",
  line: "rgba(234,240,255,0.10)",
};

// ── Deterministic move engine ──────────────────────────────────────────────
// The product intelligence, local-first. AI (Pro) later personalizes this;
// the core loop never depends on a network call at the impatient moment.
const MOVE_RULES = [
  { k: ["study", "studying", "exam", "revise", "read", "material", "course"],
    move: "Open the material and read one page for five minutes." },
  { k: ["email", "message", "reply", "text", "respond", "dm", "whatsapp", "slack"],
    move: "Open the conversation and write the first honest sentence." },
  { k: ["clean", "cleaning", "chore", "tidy", "dishes", "laundry", "mess"],
    move: "Clear one visible surface, or put away five things." },
  { k: ["decide", "decision", "choose", "choice", "pick"],
    move: "Choose the reversible option and test it for ten minutes." },
  { k: ["work", "project", "deck", "report", "proposal", "deadline", "task", "file"],
    move: "Open the file and finish only the first visible step." },
  { k: ["workout", "gym", "exercise", "run", "walk", "move", "training"],
    move: "Put on your shoes and start two minutes of movement." },
  { k: ["call", "phone", "meeting", "conversation", "talk", "ask"],
    move: "Write the one sentence you need to say, then make the call." },
  { k: ["start", "begin", "starting"],
    move: "Do the smallest first version for five minutes. Ugly is fine." },
  { k: ["money", "budget", "invoice", "bill", "pay", "finance", "tax"],
    move: "Open the account or bill and note the single next number." },
];
const DEFAULT_MOVE = "Do the smallest visible first step for five minutes.";

function suggestMove(avoiding: string): string {
  const s = avoiding.toLowerCase();
  for (const r of MOVE_RULES)
    if (r.k.some((w: string) => s.includes(w))) return r.move;
  return DEFAULT_MOVE;
}

const EXAMPLES = ["Start", "Study", "Reply", "Decide", "A chore", "A call"];

const REWARDS = [
  "That's evidence. Not a feeling — a fact.",
  "You just beat the version of you that stalls.",
  "Small move, real momentum.",
  "You started. That's the whole game.",
  "The gap between knowing and doing just shrank.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

// ── Breathing orb (signature) ──────────────────────────────────────────────
function BreathOrb({
  phase,
  hue,
  size = 300,
  dim = false,
}: {
  phase: "in" | "out" | "idle";
  hue: string;
  size?: number;
  dim?: boolean;
}) {
  const scale = phase === "in" ? 1.16 : phase === "out" ? 0.84 : 1;
  const dur = phase === "idle" ? "6s" : "5s";
  return (
    <div style={{ width: size, height: size, position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden>
      <div style={{ position: "absolute", width: size * 1.9, height: size * 1.9,
        borderRadius: "50%", background: `radial-gradient(circle, ${hue}22 0%, transparent 62%)`,
        filter: "blur(8px)", animation: "orbHalo 7s ease-in-out infinite" }} />
      {[1.5, 1.24, 1.05].map((m: number, i: number) => (
        <div key={i} style={{ position: "absolute", width: size * m, height: size * m,
          borderRadius: "50%", border: `1px solid ${hue}${i === 2 ? "3a" : "20"}`,
          transition: `transform ${dur} cubic-bezier(.37,0,.63,1), opacity ${dur} ease`,
          transform: `scale(${phase === "in" ? 1.05 : phase === "out" ? 0.97 : 1})`,
          opacity: dim ? 0.4 : 0.75 }} />
      ))}
      <div style={{ width: size * 0.62, height: size * 0.62, borderRadius: "50%",
        background: `radial-gradient(ellipse at 38% 32%, ${hue} 0%, ${hue}cc 34%, ${hue}44 70%, transparent 82%)`,
        boxShadow: `0 0 ${size * 0.5}px ${hue}55, 0 0 ${size * 0.16}px ${hue}66 inset`,
        transition: `transform ${dur} cubic-bezier(.37,0,.63,1)`,
        transform: `scale(${scale})`, animation: "orbMorph 14s ease-in-out infinite", position: "relative" }}>
        <div style={{ position: "absolute", top: "24%", left: "26%", width: "26%", height: "26%",
          borderRadius: "50%", background: `radial-gradient(circle, #fff 0%, ${hue} 55%, transparent 72%)`,
          filter: "blur(3px)", opacity: 0.85, animation: "orbSpark 3.4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

const btn = (grad: string, glow: string): React.CSSProperties => ({
  width: "100%", maxWidth: 360, padding: "17px", borderRadius: 999, border: "none",
  background: grad, color: "#04121A", fontSize: 16, fontWeight: 800, cursor: "pointer",
  boxShadow: `0 12px 40px ${glow}`,
});

export default function App() {
  // welcome | breathe | clear | move | commit | done | followup | evidence
  type ScreenName =
    | "welcome"
    | "breathe"
    | "clear"
    | "move"
    | "commit"
    | "done"
    | "followup"
    | "evidence";
  const [screen, setScreen] = useState<ScreenName>("welcome");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [loopCount, setLoopCount] = useState(0);
  const [evidence, setEvidence] = useState(0);
  const [reward, setReward] = useState("");
  const seed = useMemo(() => Date.now() % 997, []);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (screen === "clear" || screen === "move") {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const bg = useMemo(() => {
    if (screen === "move" || screen === "commit")
      return `radial-gradient(ellipse at 50% 30%, #2A1B10 0%, ${C.ink} 60%)`;
    if (screen === "done" || screen === "followup")
      return `radial-gradient(ellipse at 50% 34%, #12281F 0%, ${C.ink} 62%)`;
    return `radial-gradient(ellipse at 50% 28%, #141B36 0%, ${C.ink} 60%)`;
  }, [screen]);

  function startReset() {
    setAvoiding("");
    setMove("");
    setScreen("breathe");
  }
  function fullExit() {
    setAvoiding(""); setMove(""); setLoopCount(0); setScreen("welcome");
  }

  // breathe controller (~5s each phase, ~2 cycles ≈ 20s)
  const [phase, setPhase] = useState<"in" | "out" | "idle">("in");
  const [breaths, setBreaths] = useState(0);
  useEffect(() => {
    if (screen !== "breathe") return;
    setPhase("in"); setBreaths(0);
    let inhale = true;
    const id = setInterval(() => {
      inhale = !inhale;
      setPhase(inhale ? "in" : "out");
      if (inhale) setBreaths((b) => b + 1);
    }, 5000);
    return () => clearInterval(id);
  }, [screen]);
  const breatheReady = breaths >= 2;

  function goMove() {
    setMove(suggestMove(avoiding));
    setScreen("move");
  }
  function logEvidence() {
    setEvidence((e) => e + 1);
    setReward(pick(REWARDS, seed + evidence + loopCount));
    setScreen("done");
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: bg,
      transition: "background 0.9s ease",
      fontFamily: "'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
      color: C.text, display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes orbMorph {0%,100%{border-radius:60% 40% 32% 68% / 60% 34% 66% 40%;}33%{border-radius:40% 60% 68% 32% / 46% 64% 36% 54%;}66%{border-radius:52% 48% 40% 60% / 66% 40% 60% 34%;}}
        @keyframes orbHalo{0%,100%{opacity:.7;transform:scale(1);}50%{opacity:1;transform:scale(1.08);}}
        @keyframes orbSpark{0%,100%{opacity:.65;transform:scale(1);}50%{opacity:1;transform:scale(1.3);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes pop{0%{transform:scale(.9);opacity:0;}60%{transform:scale(1.04);}100%{transform:scale(1);opacity:1;}}
        *{box-sizing:border-box;} input,textarea,button{font-family:inherit;}
        textarea::placeholder,input::placeholder{color:rgba(234,240,255,0.28);}
        .rs{transition:transform .18s ease,box-shadow .25s ease,opacity .2s ease;}
        .rs:hover:not(:disabled){transform:translateY(-2px);}
        .rs:active:not(:disabled){transform:translateY(0) scale(.98);}
        .rs:focus-visible{outline:2px solid ${C.calm};outline-offset:3px;}
        .chip{transition:background .2s ease,border-color .2s ease;}
        .chip:hover{background:rgba(61,217,196,0.14);border-color:${C.calm}66;}
        @media (prefers-reduced-motion: reduce){*{animation:none !important;transition:background .3s ease !important;}}
      `}</style>

      {/* top bar */}
      {screen !== "welcome" && (
        <div style={{ width: "100%", maxWidth: 440, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "20px 24px 0" }}>
          <button onClick={fullExit} className="rs" style={{ background: "none", border: "none",
            color: C.textFaint, fontSize: 13, cursor: "pointer", padding: 4 }}>✕</button>
          <button onClick={() => setScreen("evidence")} className="rs" style={{ display: "flex",
            alignItems: "center", gap: 7, background: "rgba(61,217,196,0.08)",
            border: `1px solid ${C.calm}33`, borderRadius: 999, padding: "6px 13px",
            cursor: "pointer", color: C.calm, fontSize: 12, fontWeight: 600 }}>
            <span>◆</span>{evidence}
          </button>
        </div>
      )}

      {/* WELCOME */}
      {screen === "welcome" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "0 28px", textAlign: "center", maxWidth: 480,
          animation: "fadeIn .8s ease" }}>
          <BreathOrb phase="idle" hue={C.calm} size={230} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.34em", color: C.textFaint,
            textTransform: "uppercase", margin: "18px 0" }}>Reset</div>
          <h1 style={{ fontSize: 33, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.03em",
            margin: "0 0 16px" }}>The noise between<br />knowing and doing.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.textDim, margin: "0 0 40px", maxWidth: 330 }}>
            One breath. One avoided thing. One next move.
          </p>
          <button onClick={startReset} className="rs"
            style={btn(`linear-gradient(135deg, ${C.calm}, ${C.cool})`, `${C.calm}44`)}>
            Start a reset
          </button>
        </div>
      )}

      {/* BREATHE */}
      {screen === "breathe" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 24px 40px", animation: "fadeIn .6s ease" }}>
          <BreathOrb phase={phase} hue={C.calm} size={330} />
          <div style={{ marginTop: 14, fontSize: 24, fontWeight: 600, letterSpacing: "0.04em",
            transition: "opacity .4s ease" }}>{phase === "in" ? "Breathe in…" : "…and out"}</div>
          {breatheReady ? (
            <button onClick={() => setScreen("clear")} className="rs"
              style={{ ...btn(`linear-gradient(135deg, ${C.calm}, ${C.cool})`, `${C.calm}44`),
                marginTop: 36, animation: "pop .5s ease" }}>Ready — clear the noise</button>
          ) : (
            <>
              <button onClick={() => setScreen("clear")} className="rs" style={{ marginTop: 34,
                background: "none", border: "none", color: C.textFaint, fontSize: 14,
                cursor: "pointer" }}>Skip breath →</button>
              <div style={{ marginTop: 10, fontSize: 12, color: C.textFaint, letterSpacing: "0.1em" }}>
                Follow the orb</div>
            </>
          )}
        </div>
      )}

      {/* CLEAR — the one required input */}
      {screen === "clear" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", padding: "16px 28px 34px",
          animation: "fadeUp .5s ease" }}>
          <div style={{ margin: "10px 0 8px" }}><BreathOrb phase="idle" hue={C.calm} size={130} dim /></div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase",
            color: C.calm, margin: "10px 0 16px" }}>Clear</div>
          <h2 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center",
            margin: "0 0 22px", lineHeight: 1.2 }}>What are you avoiding?</h2>
          <input ref={inputRef} value={avoiding} onChange={(e) => setAvoiding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && avoiding.trim() && goMove()}
            placeholder="the thing you keep sliding past…"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`,
              borderRadius: 16, padding: "18px", fontSize: 19, color: C.text, outline: "none",
              transition: "border .25s ease", textAlign: "center" }}
            onFocus={(e) => (e.target.style.borderColor = C.calm)}
            onBlur={(e) => (e.target.style.borderColor = C.line)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip rs" onClick={() => setAvoiding(ex)}
                style={{ background: "rgba(61,217,196,0.06)", border: `1px solid ${C.calm}30`,
                  borderRadius: 999, padding: "8px 15px", color: C.textDim, fontSize: 14,
                  cursor: "pointer" }}>{ex}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button disabled={!avoiding.trim()} onClick={goMove} className="rs"
            style={{ ...btn(`linear-gradient(135deg, ${C.calm}, ${C.cool})`, `${C.calm}33`),
              marginTop: 24, opacity: avoiding.trim() ? 1 : 0.4 }}>Find my next move</button>
        </div>
      )}

      {/* MOVE — suggested, editable */}
      {screen === "move" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", padding: "16px 28px 34px",
          animation: "fadeUp .5s ease" }}>
          <div style={{ margin: "10px 0 8px" }}><BreathOrb phase="idle" hue={C.energy} size={130} dim /></div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase",
            color: C.energy, margin: "10px 0 16px" }}>Move</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center",
            margin: "0 0 8px", lineHeight: 1.25 }}>Your next visible move</h2>
          <p style={{ fontSize: 13, color: C.textDim, textAlign: "center", margin: "0 0 20px" }}>
            Small enough it's harder to skip than to do. Edit if you want.</p>
          <textarea ref={inputRef} value={move} onChange={(e) => setMove(e.target.value)} rows={3}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.energy}44`, borderRadius: 16, padding: "18px", fontSize: 18,
              lineHeight: 1.5, color: C.text, resize: "none", outline: "none", textAlign: "center" }}
            onFocus={(e) => (e.target.style.borderColor = C.energy)}
            onBlur={(e) => (e.target.style.borderColor = C.energy + "44")} />
          <div style={{ flex: 1 }} />
          <button disabled={!move.trim()} onClick={() => setScreen("commit")} className="rs"
            style={{ ...btn(`linear-gradient(135deg, ${C.energy}, ${C.energyHot})`, `${C.energy}44`),
              marginTop: 24, opacity: move.trim() ? 1 : 0.4 }}>Commit to this</button>
        </div>
      )}

      {/* COMMIT */}
      {screen === "commit" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 28px 40px", textAlign: "center", animation: "fadeIn .5s ease" }}>
          <BreathOrb phase="idle" hue={C.energy} size={200} />
          <p style={{ fontSize: 14, color: C.energy, fontWeight: 700, letterSpacing: "0.2em",
            textTransform: "uppercase", margin: "14px 0 10px" }}>Now, not later</p>
          <h2 style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.35, margin: "0 0 34px",
            maxWidth: 360 }}>{move}</h2>
          <button onClick={logEvidence} className="rs"
            style={btn(`linear-gradient(135deg, ${C.energy}, ${C.energyHot})`, `${C.energy}55`)}>
            I'm doing it now
          </button>
          <button onClick={() => setScreen("move")} className="rs" style={{ marginTop: 14,
            background: "none", border: "none", color: C.textFaint, fontSize: 14, cursor: "pointer" }}>
            Make it smaller</button>
        </div>
      )}

      {/* DONE + reward + capped loop */}
      {screen === "done" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 28px 40px", textAlign: "center", animation: "fadeUp .5s ease" }}>
          <div style={{ animation: "pop .6s ease" }}><BreathOrb phase="idle" hue={C.calm} size={170} /></div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase",
            color: C.calm, margin: "12px 0" }}>Evidence #{evidence}</div>
          <h2 style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 30px",
            lineHeight: 1.3, maxWidth: 360 }}>{reward}</h2>
          {loopCount < 2 ? (
            <>
              <button onClick={() => { setLoopCount((n) => n + 1); startReset(); }} className="rs"
                style={{ ...btn(`linear-gradient(135deg, ${C.energy}, ${C.energyHot})`, `${C.energy}44`),
                  marginBottom: 12 }}>Clear the next noise →</button>
              <button onClick={() => setScreen("followup")} className="rs" style={{ background: "none",
                border: "none", color: C.textDim, fontSize: 15, cursor: "pointer", padding: 8 }}>
                I'm clear for now</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: C.textFaint, margin: "0 0 22px", lineHeight: 1.6,
                maxWidth: 320 }}>Enough for one sitting. Momentum beats marathon — come back when the
                noise builds again.</p>
              <button onClick={() => setScreen("followup")} className="rs"
                style={{ ...btn("rgba(61,217,196,0.08)", "transparent"), color: C.calm,
                  border: `1px solid ${C.calm}55` }}>Land it</button>
            </>
          )}
        </div>
      )}

      {/* FOLLOWUP — the one integrity check (keeps evidence honest) */}
      {screen === "followup" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 28px 40px", textAlign: "center", animation: "fadeIn .5s ease" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.3 }}>
            Quick honesty check.</h2>
          <p style={{ fontSize: 16, color: C.textDim, margin: "0 0 32px", maxWidth: 320, lineHeight: 1.6 }}>
            You said you'd start "{move.slice(0, 40)}". Did you actually begin it?</p>
          <button onClick={fullExit} className="rs"
            style={{ ...btn(`linear-gradient(135deg, ${C.calm}, ${C.cool})`, `${C.calm}33`),
              marginBottom: 12 }}>Yes — I started</button>
          <button onClick={() => { setEvidence((e) => Math.max(0, e - 1)); fullExit(); }} className="rs"
            style={{ background: "none", border: "none", color: C.textFaint, fontSize: 14,
              cursor: "pointer", padding: 8 }}>Not yet — don't count it</button>
        </div>
      )}

      {/* EVIDENCE */}
      {screen === "evidence" && (
        <div style={{ flex: 1, width: "100%", maxWidth: 440, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 28px 40px", textAlign: "center", animation: "fadeUp .5s ease" }}>
          <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: "-0.04em",
            background: `linear-gradient(135deg, ${C.calm}, ${C.cool})`, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent", lineHeight: 1 }}>{evidence}</div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            color: C.textFaint, margin: "10px 0 26px" }}>times you began</div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: C.textDim, maxWidth: 320, margin: "0 0 40px" }}>
            Not streaks. Evidence. Every number is a moment you moved instead of spun — proof you can
            begin. That's what discipline is made of.</p>
          <button onClick={() => setScreen("welcome")} className="rs"
            style={btn(`linear-gradient(135deg, ${C.calm}, ${C.cool})`, `${C.calm}33`)}>Back</button>
        </div>
      )}

      <div style={{ padding: "16px 0 22px", fontSize: 11, letterSpacing: "0.16em",
        textTransform: "uppercase", color: C.textFaint }}>Cut the noise · Make the move</div>
    </div>
  );
}

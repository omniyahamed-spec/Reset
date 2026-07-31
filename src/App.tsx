import { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================================
   RESET — 3-step clarity engine
   ----------------------------------------------------------------------------
   Flow (the whole product, on purpose):
     NOISE  →  AVOIDING  →  MOVE  →  BREATHE  →  DONE  →  (loop or land)
   Everything else (history, evidence, reward) is earned depth, never the path.

   Design thesis: the screen literally travels from CALM (indigo→teal) on the
   thinking steps to ENERGY (amber) on the action step. Color does the coaching.
   The breathing orb is the signature: large, alive, paced to a real breath.
============================================================================ */

// ---- palette -------------------------------------------------------------
const C = {
  ink: "#0B1020",       // deep near-black indigo base
  ink2: "#121A32",      // raised surface
  calm: "#3DD9C4",      // teal — clarity
  calmDim: "#1E8C82",
  cool: "#6C7BFF",      // indigo — thought
  energy: "#FFB23E",    // amber — action
  energyHot: "#FF7A45", // hot amber accent
  text: "#EAF0FF",
  textDim: "rgba(234,240,255,0.58)",
  textFaint: "rgba(234,240,255,0.34)",
  line: "rgba(234,240,255,0.10)",
};

const STEPS = ["noise", "avoiding", "move"];

// Rotating one-line prompts so the three questions never feel like a form.
const PROMPTS = {
  noise: [
    "What's loudest in your head right now?",
    "What keeps looping when you try to focus?",
    "Say the noise out loud. What is it?",
  ],
  avoiding: [
    "What are you actually avoiding?",
    "What's the thing you keep sliding past?",
    "Name it plainly — what are you dodging?",
  ],
  move: [
    "One small move. What unlocks the rest?",
    "The smallest next action — what is it?",
    "If you did just one thing, what?",
  ],
};

// Deterministic pick-of-the-day so the app feels alive but stable per session.
function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

// ---------------------------------------------------------------------------
// BREATHING ORB — the signature. Large, layered, paced to inhale/exhale.
// ---------------------------------------------------------------------------
function BreathOrb({ phase, hue, size = 300, dim = false }) {
  // phase: "in" | "out" | "idle"
  const scale = phase === "in" ? 1.18 : phase === "out" ? 0.82 : 1;
  const dur = phase === "idle" ? "6s" : "4s";
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {/* atmospheric wash */}
      <div
        style={{
          position: "absolute",
          width: size * 1.9,
          height: size * 1.9,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hue}22 0%, transparent 62%)`,
          filter: "blur(8px)",
          animation: "orbHalo 7s ease-in-out infinite",
        }}
      />
      {/* concentric guide rings */}
      {[1.5, 1.24, 1.05].map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: size * m,
            height: size * m,
            borderRadius: "50%",
            border: `1px solid ${hue}${i === 2 ? "3a" : "20"}`,
            transition: `transform ${dur} cubic-bezier(.37,0,.63,1), opacity ${dur} ease`,
            transform: `scale(${phase === "in" ? 1.06 : phase === "out" ? 0.96 : 1})`,
            opacity: dim ? 0.4 : 0.75,
          }}
        />
      ))}
      {/* core */}
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 38% 32%, ${hue} 0%, ${hue}cc 34%, ${hue}44 70%, transparent 82%)`,
          boxShadow: `0 0 ${size * 0.5}px ${hue}55, 0 0 ${size * 0.16}px ${hue}66 inset`,
          transition: `transform ${dur} cubic-bezier(.37,0,.63,1)`,
          transform: `scale(${scale})`,
          animation: "orbMorph 14s ease-in-out infinite",
          position: "relative",
        }}
      >
        {/* inner spark */}
        <div
          style={{
            position: "absolute",
            top: "24%",
            left: "26%",
            width: "26%",
            height: "26%",
            borderRadius: "50%",
            background: `radial-gradient(circle, #ffffff 0%, ${hue} 55%, transparent 72%)`,
            filter: "blur(3px)",
            opacity: 0.85,
            animation: "orbSpark 3.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function StepDots({ index }) {
  return (
    <div style={{ display: "flex", gap: 7, justifyContent: "center" }}>
      {STEPS.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 26 : 7,
            height: 7,
            borderRadius: 999,
            background:
              i < index ? C.calm : i === index ? C.calm : "rgba(234,240,255,0.14)",
            boxShadow: i === index ? `0 0 10px ${C.calm}` : "none",
            transition: "all .35s ease",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export default function App() {
  // screen: welcome | noise | avoiding | move | breathe | done | evidence
  const [screen, setScreen] = useState("welcome");
  const [noise, setNoise] = useState("");
  const [avoiding, setAvoiding] = useState("");
  const [move, setMove] = useState("");
  const [loopCount, setLoopCount] = useState(0); // moves chained this session
  const seed = useMemo(() => Date.now() % 997, []);

  // "Evidence" = discipline made visible. Persisted in memory only (artifact-safe).
  const [evidence, setEvidence] = useState(0);
  const [lastReward, setLastReward] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (["noise", "avoiding", "move"].includes(screen)) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // Screen background travels calm → energy.
  const bg = useMemo(() => {
    if (screen === "move" || screen === "breathe")
      return `radial-gradient(ellipse at 50% 30%, #2A1B10 0%, ${C.ink} 60%)`;
    if (screen === "done")
      return `radial-gradient(ellipse at 50% 34%, #12281F 0%, ${C.ink} 62%)`;
    return `radial-gradient(ellipse at 50% 28%, #141B36 0%, ${C.ink} 60%)`;
  }, [screen]);

  const stepIndex = STEPS.indexOf(screen);

  function reset() {
    setNoise("");
    setAvoiding("");
    setMove("");
    setScreen("noise");
  }

  function fullExit() {
    setNoise("");
    setAvoiding("");
    setMove("");
    setLoopCount(0);
    setScreen("welcome");
  }

  // ---- BREATHE controller ----
  const [phase, setPhase] = useState("in");
  const [breaths, setBreaths] = useState(0);
  useEffect(() => {
    if (screen !== "breathe") return;
    setPhase("in");
    setBreaths(0);
    let inhale = true;
    const id = setInterval(() => {
      inhale = !inhale;
      setPhase(inhale ? "in" : "out");
      if (inhale) setBreaths((b) => b + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [screen]);

  // three full breaths, then reveal the commit
  const breathDone = breaths >= 3;

  // ---- reward logic: VARIABLE, not fixed (the retention trick) ----
  const REWARDS = [
    "That's evidence. Not a feeling — a fact.",
    "You just beat the version of you that scrolls.",
    "Small move, real momentum. Again tomorrow.",
    "You showed up. That compounds quietly.",
    "The gap between knowing and doing just shrank.",
  ];
  function completeMove() {
    setEvidence((e) => e + 1);
    setLastReward(pick(REWARDS, seed + evidence + loopCount));
    setScreen("done");
  }

  // ======================================================================
  // RENDER
  // ======================================================================
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: bg,
        transition: "background 0.9s ease",
        fontFamily:
          "'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        color: C.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes orbMorph {
          0%,100% { border-radius: 60% 40% 32% 68% / 60% 34% 66% 40%; }
          33%     { border-radius: 40% 60% 68% 32% / 46% 64% 36% 54%; }
          66%     { border-radius: 52% 48% 40% 60% / 66% 40% 60% 34%; }
        }
        @keyframes orbHalo { 0%,100%{opacity:.7;transform:scale(1);} 50%{opacity:1;transform:scale(1.08);} }
        @keyframes orbSpark { 0%,100%{opacity:.65;transform:scale(1);} 50%{opacity:1;transform:scale(1.3);} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes pop { 0%{transform:scale(.9);opacity:0;} 60%{transform:scale(1.04);} 100%{transform:scale(1);opacity:1;} }
        * { box-sizing: border-box; }
        input, textarea, button { font-family: inherit; }
        textarea::placeholder, input::placeholder { color: rgba(234,240,255,0.28); }
        .rs-cta { transition: transform .18s ease, box-shadow .25s ease, opacity .2s ease; }
        .rs-cta:hover:not(:disabled) { transform: translateY(-2px); }
        .rs-cta:active:not(:disabled) { transform: translateY(0) scale(.98); }
        .rs-cta:focus-visible { outline: 2px solid ${C.calm}; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: background .3s ease !important; }
        }
      `}</style>

      {/* top bar: evidence counter (discipline made visible) */}
      {screen !== "welcome" && (
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 0",
          }}
        >
          <button
            onClick={fullExit}
            className="rs-cta"
            style={{
              background: "none",
              border: "none",
              color: C.textFaint,
              fontSize: 13,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
          <button
            onClick={() => setScreen("evidence")}
            className="rs-cta"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(61,217,196,0.08)",
              border: `1px solid ${C.calm}33`,
              borderRadius: 999,
              padding: "6px 13px",
              cursor: "pointer",
              color: C.calm,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ fontSize: 13 }}>◆</span>
            {evidence} moves
          </button>
        </div>
      )}

      {/* ---------------- WELCOME ---------------- */}
      {screen === "welcome" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 28px",
            textAlign: "center",
            maxWidth: 480,
            animation: "fadeIn .8s ease",
          }}
        >
          <div style={{ marginTop: -10, marginBottom: 8 }}>
            <BreathOrb phase="idle" hue={C.calm} size={230} />
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.34em",
              color: C.textFaint,
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Reset
          </div>
          <h1
            style={{
              fontSize: 34,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
            }}
          >
            Too much in your head
            <br />
            to start?
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: C.textDim,
              margin: "0 0 40px",
              maxWidth: 340,
            }}
          >
            Three questions. One breath. One move. Three minutes to cut the
            noise and act.
          </p>
          <button
            onClick={() => setScreen("noise")}
            className="rs-cta"
            style={{
              padding: "17px 52px",
              borderRadius: 999,
              border: "none",
              background: `linear-gradient(135deg, ${C.calm}, ${C.cool})`,
              color: "#04121A",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 12px 40px ${C.calm}44`,
            }}
          >
            Start a reset
          </button>
        </div>
      )}

      {/* ---------------- THE 3 QUESTIONS ---------------- */}
      {["noise", "avoiding", "move"].includes(screen) && (
        <div
          key={screen}
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "16px 28px 34px",
            animation: "fadeUp .5s ease",
          }}
        >
          {/* small ambient orb keeps the calm presence without dominating */}
          <div style={{ margin: "10px 0 6px" }}>
            <BreathOrb
              phase="idle"
              hue={screen === "move" ? C.energy : C.calm}
              size={150}
              dim
            />
          </div>

          <StepDots index={stepIndex} />

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: screen === "move" ? C.energy : C.calm,
              margin: "26px 0 14px",
            }}
          >
            {screen === "noise"
              ? "Step 1 · Noise"
              : screen === "avoiding"
              ? "Step 2 · Avoiding"
              : "Step 3 · Next move"}
          </div>

          <h2
            style={{
              fontSize: 25,
              lineHeight: 1.25,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textAlign: "center",
              margin: "0 0 26px",
              minHeight: 64,
            }}
          >
            {pick(PROMPTS[screen], seed + stepIndex)}
          </h2>

          <textarea
            ref={inputRef}
            value={screen === "noise" ? noise : screen === "avoiding" ? avoiding : move}
            onChange={(e) =>
              screen === "noise"
                ? setNoise(e.target.value)
                : screen === "avoiding"
                ? setAvoiding(e.target.value)
                : setMove(e.target.value)
            }
            rows={3}
            placeholder={
              screen === "noise"
                ? "the meeting, the message, the thing I can't drop…"
                : screen === "avoiding"
                ? "the one I keep sliding past…"
                : "open the doc and write one ugly line…"
            }
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${screen === "move" ? C.energy + "44" : C.line}`,
              borderRadius: 18,
              padding: "18px 18px",
              fontSize: 18,
              lineHeight: 1.5,
              color: C.text,
              resize: "none",
              outline: "none",
              transition: "border .25s ease",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = screen === "move" ? C.energy : C.calm)
            }
            onBlur={(e) =>
              (e.target.style.borderColor =
                screen === "move" ? C.energy + "44" : C.line)
            }
          />

          {/* the move step nudges toward SMALLER — the compliance trick */}
          {screen === "move" && (
            <div
              style={{
                fontSize: 13,
                color: C.textDim,
                marginTop: 12,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Make it so small it's harder to skip than to do. Two minutes, one
              tap, one sentence.
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            disabled={
              (screen === "noise" && !noise.trim()) ||
              (screen === "avoiding" && !avoiding.trim()) ||
              (screen === "move" && !move.trim())
            }
            onClick={() =>
              screen === "noise"
                ? setScreen("avoiding")
                : screen === "avoiding"
                ? setScreen("move")
                : setScreen("breathe")
            }
            className="rs-cta"
            style={{
              width: "100%",
              padding: "17px",
              borderRadius: 999,
              border: "none",
              marginTop: 24,
              background:
                screen === "move"
                  ? `linear-gradient(135deg, ${C.energy}, ${C.energyHot})`
                  : `linear-gradient(135deg, ${C.calm}, ${C.cool})`,
              color: "#04121A",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              opacity:
                (screen === "noise" && !noise.trim()) ||
                (screen === "avoiding" && !avoiding.trim()) ||
                (screen === "move" && !move.trim())
                  ? 0.4
                  : 1,
              boxShadow:
                screen === "move"
                  ? `0 12px 40px ${C.energy}44`
                  : `0 12px 40px ${C.calm}33`,
            }}
          >
            {screen === "noise"
              ? "Next"
              : screen === "avoiding"
              ? "Next"
              : "Breathe, then commit"}
          </button>
        </div>
      )}

      {/* ---------------- BREATHE ---------------- */}
      {screen === "breathe" && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px 40px",
            animation: "fadeIn .6s ease",
          }}
        >
          <BreathOrb phase={phase} hue={C.energy} size={330} />
          <div
            style={{
              marginTop: 14,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: C.text,
              transition: "opacity .4s ease",
            }}
          >
            {phase === "in" ? "Breathe in…" : "…and out"}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: C.textFaint,
              letterSpacing: "0.1em",
            }}
          >
            {Math.min(breaths, 3)} / 3
          </div>

          {breathDone && (
            <button
              onClick={completeMove}
              className="rs-cta"
              style={{
                marginTop: 40,
                padding: "18px 40px",
                borderRadius: 999,
                border: "none",
                background: `linear-gradient(135deg, ${C.energy}, ${C.energyHot})`,
                color: "#1A0E02",
                fontSize: 17,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: `0 14px 46px ${C.energy}55`,
                animation: "pop .5s ease",
                maxWidth: 340,
                width: "100%",
                lineHeight: 1.35,
              }}
            >
              I'll do it now: {move.length > 34 ? move.slice(0, 34) + "…" : move}
            </button>
          )}
          {!breathDone && (
            <div style={{ marginTop: 40, fontSize: 13, color: C.textFaint }}>
              Let the orb lead. Commit unlocks after three.
            </div>
          )}
        </div>
      )}

      {/* ---------------- DONE + reward + LOOP ---------------- */}
      {screen === "done" && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 28px 40px",
            textAlign: "center",
            animation: "fadeUp .5s ease",
          }}
        >
          <div style={{ animation: "pop .6s ease" }}>
            <BreathOrb phase="idle" hue={C.calm} size={180} />
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: C.calm,
              margin: "12px 0 12px",
            }}
          >
            Move #{evidence} logged
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 14px",
              lineHeight: 1.25,
            }}
          >
            {lastReward}
          </h2>
          <p style={{ fontSize: 15, color: C.textDim, margin: "0 0 36px", lineHeight: 1.6 }}>
            You cut the noise around{" "}
            <span style={{ color: C.text }}>"{noise.slice(0, 40)}"</span> and
            moved anyway.
          </p>

          {/* THE LOOP: one more small move, capped so it never becomes a to-do list */}
          {loopCount < 2 ? (
            <>
              <button
                onClick={() => {
                  setLoopCount((n) => n + 1);
                  reset();
                }}
                className="rs-cta"
                style={{
                  width: "100%",
                  maxWidth: 340,
                  padding: "16px",
                  borderRadius: 999,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.energy}, ${C.energyHot})`,
                  color: "#1A0E02",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: `0 12px 40px ${C.energy}44`,
                  marginBottom: 14,
                }}
              >
                Ride the momentum — one more →
              </button>
              <button
                onClick={fullExit}
                className="rs-cta"
                style={{
                  background: "none",
                  border: "none",
                  color: C.textDim,
                  fontSize: 15,
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                I'm clear. Done for now.
              </button>
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: 14,
                  color: C.textFaint,
                  margin: "0 0 22px",
                  lineHeight: 1.6,
                }}
              >
                That's enough for one sitting. Momentum beats marathon — come
                back when the noise builds again.
              </p>
              <button
                onClick={fullExit}
                className="rs-cta"
                style={{
                  width: "100%",
                  maxWidth: 340,
                  padding: "16px",
                  borderRadius: 999,
                  border: `1px solid ${C.calm}55`,
                  background: "rgba(61,217,196,0.08)",
                  color: C.calm,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Land it. See you next reset.
              </button>
            </>
          )}
        </div>
      )}

      {/* ---------------- EVIDENCE (discipline made visible) ---------------- */}
      {screen === "evidence" && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 28px 40px",
            textAlign: "center",
            animation: "fadeUp .5s ease",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              background: `linear-gradient(135deg, ${C.calm}, ${C.cool})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
            }}
          >
            {evidence}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.textFaint,
              margin: "10px 0 26px",
            }}
          >
            moves that actually happened
          </div>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: C.textDim,
              maxWidth: 320,
              margin: "0 0 40px",
            }}
          >
            Not streaks. Not points. Evidence. Every number here is a moment you
            chose to move instead of spin. That's what discipline is made of.
          </p>
          <button
            onClick={() => setScreen("welcome")}
            className="rs-cta"
            style={{
              padding: "16px 44px",
              borderRadius: 999,
              border: "none",
              background: `linear-gradient(135deg, ${C.calm}, ${C.cool})`,
              color: "#04121A",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 12px 40px ${C.calm}33`,
            }}
          >
            Back
          </button>
        </div>
      )}

      <div
        style={{
          padding: "16px 0 22px",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: C.textFaint,
        }}
      >
        Cut the noise · Make the move
      </div>
    </div>
  );
}

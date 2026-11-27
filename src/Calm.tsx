// One calm minute on the web: ?calm (any time), ?calm=start (before work), ?calm=end (after work).
// A calm scene (our own pictures, public/calm-1..3.png), a breathing circle (in 4 s, out 6 s, 6 rounds = 60 s)
// and an optional rain sound made in the browser (no audio files, nothing to license).
// It ends with one line to write down and the way back to action: Reset on WhatsApp.
import { useEffect, useRef, useState } from "react";

type Lang = "en" | "ar";
type Mode = "start" | "end" | "any";

const IN = 4, OUT = 6, ROUNDS = 6, TOTAL = (IN + OUT) * ROUNDS; // seconds

const COPY = {
  en: {
    title: { start: "Before work: one calm minute", end: "After work: one calm minute", any: "One calm minute" },
    sub: { start: "Arrive first. Then pick the one thing.", end: "Close the day. Leave the rest for tomorrow.", any: "Breathe with the circle. Then one small move." },
    begin: "Start",
    in: "Breathe in",
    out: "Breathe out",
    sound: "Rain sound",
    scene: "Change scene",
    stop: "Stop",
    askStart: "What's the one thing first?",
    askEnd: "What got done today?",
    askAny: "What's the smallest move now?",
    holder: "One line",
    private: "Only for you. Not saved.",
    reset: "Reset on WhatsApp",
    again: "Another minute",
    closed: "Day closed. Well done.",
    close: "Close the day",
    back: "Back",
  },
  ar: {
    title: { start: "قبل العمل: دقيقة هدوء", end: "بعد العمل: دقيقة هدوء", any: "دقيقة هدوء" },
    sub: { start: "استعدّ أولًا، ثم اختر الأمر الأهم.", end: "أغلق يومك، واترك الباقي للغد.", any: "تنفّس مع الدائرة، ثم خطوة صغيرة واحدة." },
    begin: "ابدأ",
    in: "شهيق",
    out: "زفير",
    sound: "صوت المطر",
    scene: "تغيير المشهد",
    stop: "إيقاف",
    askStart: "ما الأمر الأول الذي ستبدأ به؟",
    askEnd: "ما الذي أنجزته اليوم؟",
    askAny: "ما أصغر خطوة الآن؟",
    holder: "سطر واحد",
    private: "لك وحدك، ولا يُحفظ.",
    reset: "ابدأ Reset عبر واتساب",
    again: "دقيقة أخرى",
    closed: "أُغلق يومك. أحسنت.",
    close: "أغلق اليوم",
    back: "رجوع",
  },
} as const;

/** Soft rain: filtered white noise, made in the browser. */
function makeRain(): { stop: () => void } | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);
    src.connect(lp).connect(hp).connect(gain).connect(ctx.destination);
    src.start();
    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
          setTimeout(() => ctx.close(), 700);
        } catch {}
      },
    };
  } catch {
    return null;
  }
}

export function calmMode(search: string): Mode {
  const v = new URLSearchParams(search).get("calm");
  return v === "start" || v === "end" ? v : "any";
}

export function Calm({ lang, wa }: { lang: Lang; wa: string }) {
  const t = COPY[lang];
  const rtl = lang === "ar";
  const mode = calmMode(window.location.search);
  const [scene, setScene] = useState(() => (Math.floor(Date.now() / 864e5) % 3) + 1);
  const [stage, setStage] = useState<"ready" | "breathe" | "after" | "closed">("ready");
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(false);
  const [line, setLine] = useState("");
  const rain = useRef<{ stop: () => void } | null>(null);
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (stage !== "breathe") return;
    const t0 = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      if (s >= TOTAL) {
        setElapsed(TOTAL);
        setStage("after");
      } else setElapsed(s);
    }, 100);
    return () => window.clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (sound && stage === "breathe") {
      if (!rain.current) rain.current = makeRain();
    } else if (rain.current) {
      rain.current.stop();
      rain.current = null;
    }
  }, [sound, stage]);
  useEffect(() => () => rain.current?.stop(), []);

  const inCycle = elapsed % (IN + OUT);
  const breathingIn = inCycle < IN;
  // 0 → 1 while breathing in, 1 → 0 while breathing out (eased).
  const p = breathingIn ? inCycle / IN : 1 - (inCycle - IN) / OUT;
  const ease = 0.5 - Math.cos(Math.PI * p) / 2;
  const scale = reduced ? 1 : 0.62 + 0.38 * ease;
  const left = Math.max(0, Math.ceil(TOTAL - elapsed));

  const glass = {
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderRadius: 20,
    padding: 20,
    color: "#1D2B30",
  } as const;
  const btn = (primary: boolean) =>
    ({
      display: "block",
      width: "100%",
      textAlign: "center",
      background: primary ? "#3B6B70" : "rgba(255,255,255,0.9)",
      color: primary ? "#fff" : "#3B6B70",
      border: primary ? "none" : "1px solid #3B6B70",
      borderRadius: 14,
      padding: "13px 16px",
      fontSize: 16,
      fontWeight: 700,
      textDecoration: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      boxSizing: "border-box",
    }) as const;
  const chip = {
    background: "rgba(255,255,255,0.75)",
    border: "none",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 14,
    color: "#1D2B30",
    cursor: "pointer",
    fontFamily: "inherit",
  } as const;

  const ask = mode === "start" ? t.askStart : mode === "end" ? t.askEnd : t.askAny;

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      lang={lang}
      style={{
        minHeight: "100vh",
        backgroundColor: "#9FB7B5",
        backgroundImage: `url(/calm-${scene}.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
        transition: "background-image 0.8s",
      }}
    >
      <div style={{ position: "fixed", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <a href={`/${lang === "ar" ? "?lang=ar" : ""}`} style={{ ...chip, textDecoration: "none" }}>{t.back}</a>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={chip} onClick={() => setScene((s) => (s % 3) + 1)}>{t.scene}</button>
          <button style={chip} aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            {sound ? "♪ " : ""}{t.sound}
          </button>
        </div>
      </div>

      {stage === "ready" && (
        <div style={{ ...glass, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t.title[mode]}</h1>
          <p style={{ fontSize: 16, color: "#4F6067", margin: "0 0 18px", lineHeight: 1.5 }}>{t.sub[mode]}</p>
          <button style={btn(true)} onClick={() => { setElapsed(0); setStage("breathe"); }}>{t.begin} · 1:00</button>
        </div>
      )}

      {stage === "breathe" && (
        <div style={{ textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: 240,
              height: 240,
              borderRadius: "50%",
              margin: "0 auto",
              background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(255,255,255,0.45) 60%, rgba(255,255,255,0.15))",
              boxShadow: "0 0 60px rgba(255,255,255,0.55)",
              transform: `scale(${scale})`,
              transition: "transform 0.1s linear",
            }}
          />
          <div aria-live="polite" style={{ ...glass, display: "inline-block", padding: "10px 18px", marginTop: 22 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{breathingIn ? t.in : t.out}</div>
            <div style={{ fontSize: 14, color: "#4F6067" }}>0:{String(left).padStart(2, "0")}</div>
          </div>
          <div>
            <button style={{ ...chip, marginTop: 14 }} onClick={() => setStage("after")}>{t.stop}</button>
          </div>
        </div>
      )}

      {stage === "after" && (
        <div style={{ ...glass, maxWidth: 380, width: "100%" }}>
          <label htmlFor="calm-line" style={{ display: "block", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{ask}</label>
          <input
            id="calm-line"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder={t.holder}
            maxLength={120}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid #C9D8D8", fontFamily: "inherit", marginBottom: 6 }}
          />
          <div style={{ fontSize: 13, color: "#5F7076", marginBottom: 16 }}>{t.private}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {mode === "end" ? (
              <button style={btn(true)} onClick={() => setStage("closed")}>{t.close}</button>
            ) : wa ? (
              <a style={btn(true)} href={wa}>{t.reset}</a>
            ) : null}
            <button style={btn(false)} onClick={() => { setElapsed(0); setStage("breathe"); }}>{t.again}</button>
          </div>
        </div>
      )}

      {stage === "closed" && (
        <div style={{ ...glass, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{t.closed}</div>
          <button style={btn(false)} onClick={() => { setElapsed(0); setStage("breathe"); }}>{t.again}</button>
        </div>
      )}
    </div>
  );
}

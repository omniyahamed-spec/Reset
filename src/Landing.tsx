// Public landing page: Reset lives in WhatsApp. One action: "Start on WhatsApp".
// English + Arabic: ?lang=ar / ?lang=en, otherwise the browser language decides.
// ?qr shows a printable poster with a QR code to this page (for events, flyers).
import { useState } from "react";
import qrcode from "qrcode-generator";
import { Privacy, Terms } from "./Legal";

const C = {
  bg: "#F4F7F7",
  ink: "#1D2B30",
  sub: "#4F6067",
  muted: "#5F7076",
  line: "#E3ECEC",
  brand: "#3B6B70",
  soft: "#E3EFEF",
  chat: "#E7F3EF",
};

type Lang = "en" | "ar";

const NUMBER = (process.env.REACT_APP_WHATSAPP_NUMBER || "").replace(/\D/g, "");
// The first message decides the bot's language (Arabic letters → Arabic).
const FIRST_MSG: Record<Lang, string> = { en: "Reset", ar: "ابدأ Reset" };
// Outreach links carry ?ref=<name> (e.g. ?ref=sara, ?ref=gym-poster). The ref rides along
// in the first WhatsApp message as "[name]"; the bot saves it (parseRef in api/_lib/flow.js).
export function getRef(search: string): string {
  const r = (new URLSearchParams(search).get("ref") || "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,24}$/.test(r) ? r : "";
}
export const refSuffix = (ref: string) => (ref ? ` [${ref}]` : "");
export const waLink = (lang: Lang, ref = "") =>
  NUMBER ? `https://wa.me/${NUMBER}?text=${encodeURIComponent(FIRST_MSG[lang] + refSuffix(ref))}` : "";

export function pickLang(search: string, browser: string | undefined): Lang {
  const q = new URLSearchParams(search).get("lang");
  if (q === "ar" || q === "en") return q;
  return (browser || "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

// Funnel events into the Google Analytics tag already in public/index.html.
const track = (name: string, params: Record<string, string>) => {
  try {
    (window as any).gtag?.("event", name, params);
  } catch {}
};

const pageUrl = (lang: Lang, ref = "") => {
  const p = new URLSearchParams();
  // If the site root is switched to the web app (REACT_APP_HOME=app), shared links must still open the landing.
  if (process.env.REACT_APP_HOME === "app") p.set("wa", "1");
  if (lang === "ar") p.set("lang", "ar");
  if (ref) p.set("ref", ref);
  const q = p.toString();
  return `${window.location.origin}/${q ? `?${q}` : ""}`;
};

// Option labels match api/_lib/copy.js so the preview shows what the bot really sends.
const COPY = {
  en: {
    switchTo: "العربية",
    tagline: "So many apps for distraction. This one is for action.",
    h1: "Stuck? Reset in 30 seconds. On WhatsApp.",
    lead: "Three taps: what's in your head, what you're avoiding, the smallest move. Then you do it. Reset checks back 5 minutes later.",
    ctaTrial: "Start on WhatsApp — 7 days free",
    cta: "Start on WhatsApp",
    soon: "Opening soon",
    noApp: "No app to install. No card needed to start.",
    chat: [
      ["bot", "What's in your head right now?"],
      ["me", "Work"],
      ["bot", "What are you avoiding?"],
      ["me", "A message"],
      ["bot", "What's the smallest move? Do it in the next 2 minutes."],
      ["me", "Send it"],
      ["bot", "Go. Send it — now. I'll check back in 5 minutes."],
      ["bot", "5 minutes. Is it still done?"],
      ["me", "Still done ✓"],
    ],
    forWho: "For the moment you know what to do and still don't start: the message you keep not sending, the task you keep reopening, the decision you keep circling.",
    price: "Price",
    trialLine: "First 7 days free. Then:",
    month: "per month",
    year: "per year · save 28%",
    aed: "AED",
    payNote: 'Pay by Apple Pay, Google Pay or card when your trial ends. Cancel anytime by sending "cancel".',
    scan: "On a computer? Scan with your phone to open WhatsApp.",
    shareTitle: "Know someone who's stuck?",
    shareBtn: "Send them Reset",
    shareText: "This helped me stop avoiding things — 3 taps on WhatsApp, then one small move:",
    copied: "Link copied",
    privacy: "Privacy",
    terms: "Terms",
    neverSell: "We never sell your data.",
    posterH: "Stuck? Reset in 30 seconds.",
    posterSub: "Scan · 3 taps on WhatsApp · one small move. 7 days free.",
  },
  ar: {
    switchTo: "English",
    tagline: "تطبيقات كثيرة للتشتّت، وهذا التطبيق للإنجاز.",
    h1: "متعثّر؟ أعد ضبط يومك في 30 ثانية عبر واتساب.",
    lead: "ثلاث ضغطات: ما يشغل ذهنك، وما تتجنبه، وأصغر خطوة ممكنة. ثم تنفّذها، ويتابع معك Reset بعد 5 دقائق.",
    ctaTrial: "ابدأ عبر واتساب — 7 أيام مجانًا",
    cta: "ابدأ عبر واتساب",
    soon: "قريبًا",
    noApp: "لا حاجة إلى تثبيت تطبيق، ولا إلى بطاقة للبدء.",
    chat: [
      ["bot", "ما الذي يشغل ذهنك الآن؟"],
      ["me", "العمل"],
      ["bot", "ما الذي تتجنبه؟"],
      ["me", "رسالة"],
      ["bot", "ما أصغر خطوة ممكنة؟ نفّذها خلال دقيقتين."],
      ["me", "أرسلها"],
      ["bot", "ابدأ الآن: أرسلها. سأعود إليك بعد 5 دقائق."],
      ["bot", "مرّت 5 دقائق. هل أنجزتها؟"],
      ["me", "أنجزتها ✓"],
    ],
    forWho: "للّحظة التي تعرف فيها ما عليك فعله ومع ذلك لا تبدأ: الرسالة التي تؤجّلها، والمهمة التي تفتحها ثم تغلقها، والقرار الذي تدور حوله.",
    price: "الأسعار",
    trialLine: "الأيام السبعة الأولى مجانية، ثم:",
    month: "شهريًا",
    year: "سنويًا · توفير 28%",
    aed: "درهم",
    payNote: 'الدفع عبر Apple Pay أو Google Pay أو البطاقة عند انتهاء التجربة. يمكنك الإلغاء في أي وقت بإرسال "إلغاء".',
    scan: "تتصفّح من الحاسوب؟ امسح الرمز بهاتفك لفتح واتساب.",
    shareTitle: "هل تعرف شخصًا متعثّرًا؟",
    shareBtn: "أرسل إليه Reset",
    shareText: "ساعدني هذا على التوقف عن التأجيل: ثلاث ضغطات عبر واتساب، ثم خطوة صغيرة:",
    copied: "تم نسخ الرابط",
    privacy: "الخصوصية",
    terms: "الشروط",
    neverSell: "لا نبيع بياناتك أبدًا.",
    posterH: "متعثّر؟ أعد ضبط يومك في 30 ثانية.",
    posterSub: "امسح الرمز · ثلاث ضغطات عبر واتساب · خطوة صغيرة. 7 أيام مجانًا.",
  },
} as const;

function Qr({ text, size }: { text: string; size: number }) {
  const qr = qrcode(0, "M");
  qr.addData(unescape(encodeURIComponent(text)), "Byte"); // UTF-8 bytes
  qr.make();
  const n = qr.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + 4} ${r + 4}h1v1h-1z`);
  return (
    <svg role="img" aria-label="QR code" viewBox={`0 0 ${n + 8} ${n + 8}`} width={size} height={size} shapeRendering="crispEdges" style={{ display: "block", background: "#fff", borderRadius: 8 }}>
      <path d={cells.join("")} fill={C.ink} />
    </svg>
  );
}

function Bubble({ me, rtl, children }: { me?: boolean; rtl: boolean; children: React.ReactNode }) {
  // In RTL the flex row is mirrored, so "flex-end" puts my messages on the left, as WhatsApp does in Arabic.
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginBottom: 6 }}>
      <div
        style={{
          maxWidth: "80%",
          background: me ? "#D9FDD3" : "#FFFFFF",
          borderRadius: 12,
          padding: "7px 10px",
          fontSize: 14,
          color: C.ink,
          boxShadow: "0 1px 0 rgba(29,43,48,0.08)",
          textAlign: rtl ? "right" : "left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Horizon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 390 120" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 90 }}>
      <circle cx="300" cy="40" r="16" fill="#F1E6D2" />
      <path d="M0 70 C60 46 120 50 180 64 C240 78 300 52 390 58 L390 120 L0 120 Z" fill="#C9DCDA" />
      <path d="M0 92 C70 74 140 82 210 90 C280 98 330 82 390 86 L390 120 L0 120 Z" fill="#A9C6C3" />
    </svg>
  );
}

function Poster({ lang, refName }: { lang: Lang; refName: string }) {
  const t = COPY[lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#fff", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Reset</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.25, margin: "0 0 18px" }}>{t.posterH}</h1>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Qr text={pageUrl(lang, refName)} size={260} />
        </div>
        <div style={{ fontSize: 17, color: C.sub, lineHeight: 1.5 }}>{t.posterSub}</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 10 }}>{pageUrl(lang).replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  );
}

export function Landing() {
  const qs = new URLSearchParams(window.location.search);
  const [lang, setLang] = useState<Lang>(() => pickLang(window.location.search, navigator.language));
  const [copied, setCopied] = useState(false);
  if (qs.has("privacy")) return <Privacy />;
  if (qs.has("terms")) return <Terms />;
  const ref = getRef(window.location.search);
  if (qs.has("qr")) return <Poster lang={lang} refName={ref} />;

  const t = COPY[lang];
  const rtl = lang === "ar";
  const wa = waLink(lang, ref);
  const desktop = typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const switchLang = () => {
    const next: Lang = rtl ? "en" : "ar";
    setLang(next);
    track("switch_lang", { to: next });
    const p = new URLSearchParams(window.location.search);
    p.set("lang", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
    document.documentElement.lang = next;
  };

  const share = async () => {
    const url = pageUrl(lang, ref);
    track("share_click", { lang });
    const nav = navigator as Navigator & { share?: (d: { text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text: t.shareText, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // user closed the share sheet
      }
    }
    if (!desktop) {
      window.location.href = `https://wa.me/?text=${encodeURIComponent(`${t.shareText} ${url}`)}`;
      return;
    }
    try {
      await navigator.clipboard.writeText(`${t.shareText} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${t.shareText} ${url}`)}`, "_blank", "noopener");
    }
  };

  const cta = (label: string, where: string) =>
    wa ? (
      <a
        href={wa}
        onClick={() => track("start_whatsapp", { lang, where, ref: ref || "direct" })}
        style={{
          display: "block",
          textAlign: "center",
          background: C.brand,
          color: "#fff",
          textDecoration: "none",
          fontWeight: 700,
          fontSize: 16,
          borderRadius: 14,
          padding: "14px 16px",
        }}
      >
        {label}
      </a>
    ) : (
      <div style={{ textAlign: "center", background: C.soft, color: C.muted, fontWeight: 700, borderRadius: 14, padding: "14px 16px" }}>
        {t.soon}
      </div>
    );

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={lang} style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Reset</div>
          <button
            onClick={switchLang}
            lang={rtl ? "en" : "ar"}
            style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 12px", fontSize: 14, color: C.brand, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            {t.switchTo}
          </button>
        </div>

        <div style={{ fontSize: 14, color: C.brand, fontWeight: 700, marginBottom: 8 }}>{t.tagline}</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.25, margin: "0 0 10px", fontWeight: 700 }}>{t.h1}</h1>
        <p style={{ fontSize: 17, color: C.sub, margin: "0 0 22px", lineHeight: 1.6 }}>{t.lead}</p>

        {cta(t.ctaTrial, "top")}
        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "8px 0 26px" }}>{t.noApp}</div>

        <div style={{ background: C.chat, borderRadius: 18, padding: 12, marginBottom: 18 }}>
          {t.chat.map(([who, line], i) => (
            <Bubble key={i} me={who === "me"} rtl={rtl}>
              {line}
            </Bubble>
          ))}
        </div>

        <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.6, margin: "0 0 22px" }}>{t.forWho}</p>

        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: rtl ? 0 : "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            {t.price}
          </div>
          <div style={{ fontSize: 15, color: C.sub, marginBottom: 12 }}>{t.trialLine}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>29 {t.aed}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{t.month}</div>
            </div>
            <div style={{ flex: 1, border: `2px solid ${C.brand}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>249 {t.aed}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{t.year}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>{t.payNote}</div>
        </div>

        {cta(t.cta, "bottom")}

        {wa && desktop && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, marginTop: 14 }}>
            <Qr text={wa} size={112} />
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.5 }}>{t.scan}</div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26 }}>
          <div style={{ fontSize: 15, color: C.sub, marginBottom: 8 }}>{t.shareTitle}</div>
          <button
            onClick={share}
            style={{ background: "#fff", border: `1px solid ${C.brand}`, color: C.brand, borderRadius: 14, padding: "10px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            {copied ? t.copied : t.shareBtn}
          </button>
        </div>

        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "22px 0 24px" }}>
          <a href="/?privacy" style={{ color: C.muted }}>{t.privacy}</a>
          {" · "}
          <a href="/?terms" style={{ color: C.muted }}>{t.terms}</a>
          {" · "}
          {t.neverSell}
        </div>
      </div>
      <Horizon />
    </div>
  );
}

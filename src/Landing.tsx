// Public landing page: Reset lives in WhatsApp. One action: "Start on WhatsApp".
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

const NUMBER = (process.env.REACT_APP_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const WA_LINK = NUMBER ? `https://wa.me/${NUMBER}?text=${encodeURIComponent("Reset")}` : "";

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
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
          textAlign: "left",
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

export function Landing() {
  const cta = (label: string) =>
    WA_LINK ? (
      <a
        href={WA_LINK}
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
        Opening soon
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "28px 20px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>
          Reset
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: "0 0 10px", fontWeight: 700 }}>
          Stuck? Reset in 30 seconds. On WhatsApp.
        </h1>
        <p style={{ fontSize: 17, color: C.sub, margin: "0 0 6px", lineHeight: 1.5 }}>
          Three taps: what's in your head, what you're avoiding, the smallest move. Then you do it. Reset checks back 5
          minutes later.
        </p>
        <p dir="rtl" style={{ fontSize: 16, color: C.sub, margin: "0 0 22px", lineHeight: 1.6, textAlign: "right" }}>
          عالق؟ ثلاث ضغطات على واتساب، وخطوة صغيرة تسويها الحين.
        </p>

        {cta("Start on WhatsApp — 7 days free")}
        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "8px 0 26px" }}>
          No app to install. No card needed to start.
        </div>

        <div style={{ background: C.chat, borderRadius: 18, padding: 12, marginBottom: 26 }}>
          <Bubble>What's in your head right now?</Bubble>
          <Bubble me>Work</Bubble>
          <Bubble>What are you avoiding?</Bubble>
          <Bubble me>A message</Bubble>
          <Bubble>Smallest move? Do it in 2 minutes.</Bubble>
          <Bubble me>Send it</Bubble>
          <Bubble>Go. Send it — now. I'll check in 5 minutes.</Bubble>
          <Bubble>5 minutes. Is it still done?</Bubble>
          <Bubble me>Still done ✓</Bubble>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Price
          </div>
          <div style={{ fontSize: 15, color: C.sub, marginBottom: 12 }}>First 7 days free. Then:</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>29 AED</div>
              <div style={{ fontSize: 13, color: C.muted }}>per month</div>
            </div>
            <div style={{ flex: 1, border: `2px solid ${C.brand}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>249 AED</div>
              <div style={{ fontSize: 13, color: C.muted }}>per year · save 28%</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>
            Pay by Apple Pay, Google Pay or card when your trial ends. Cancel anytime by sending "cancel".
          </div>
        </div>

        {cta("Start on WhatsApp")}
        <div style={{ height: 24 }} />
      </div>
      <Horizon />
    </div>
  );
}

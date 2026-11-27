// Privacy policy and terms (?privacy, ?terms). Meta needs a privacy URL before the
// WhatsApp app can go live, and Stripe asks for both. Plain language; have a lawyer review.
const CONTACT = process.env.REACT_APP_CONTACT_EMAIL || "";
const UPDATED = "23 November 2026";

const box = { maxWidth: 640, margin: "0 auto", padding: "28px 20px 48px", color: "#1D2B30", lineHeight: 1.6, fontSize: 15 } as const;
const h2 = { fontSize: 17, margin: "22px 0 6px" } as const;

function Contact() {
  return CONTACT ? (
    <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
  ) : (
    <span>send "help" to Reset on WhatsApp</span>
  );
}

export function Privacy() {
  return (
    <div style={{ background: "#F4F7F7", minHeight: "100vh" }}>
      <div style={box}>
        <a href="/" style={{ color: "#3B6B70", fontWeight: 700, textDecoration: "none" }}>← Reset</a>
        <h1 style={{ fontSize: 26, margin: "18px 0 4px" }}>Privacy</h1>
        <div style={{ color: "#5F7076", fontSize: 13 }}>Last updated {UPDATED}</div>

        <h2 style={h2}>What we keep</h2>
        <ul>
          <li>Your WhatsApp number and the profile name WhatsApp shares with us.</li>
          <li>Your resets: what's in your head, what you're avoiding, your move, and whether it stuck.</li>
          <li>Your trial and subscription status. Card details go to Stripe; we never see them.</li>
        </ul>

        <h2 style={h2}>Why</h2>
        <p>To run your resets, learn your patterns so your options get faster, send the reminders you keep on, and manage your subscription. Nothing else.</p>

        <h2 style={h2}>What we never do</h2>
        <p>We don't sell your data, rent it, or share it for advertising. We don't use it to profile you for anyone else.</p>

        <h2 style={h2}>Who processes it for us</h2>
        <ul>
          <li>Meta (WhatsApp) — delivers the messages.</li>
          <li>Supabase — stores your resets.</li>
          <li>Stripe — takes payments.</li>
          <li>Vercel — runs the service.</li>
        </ul>

        <h2 style={h2}>Your control</h2>
        <ul>
          <li>Send <b>"delete my data"</b> on WhatsApp to erase everything. We keep only a one-way code of your number so a free trial isn't reused.</li>
          <li>Send <b>"time"</b> to choose when the daily reminder comes, or <b>"no reminders"</b> to stop it. If you haven't chosen a time, the reminder moves to the hour you usually use Reset (we use only the times of your resets for this).</li>
          <li>Send <b>"cancel"</b> to manage or cancel your subscription.</li>
        </ul>

        <h2 style={h2}>Contact</h2>
        <p>
          Questions: <Contact />.
        </p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div style={{ background: "#F4F7F7", minHeight: "100vh" }}>
      <div style={box}>
        <a href="/" style={{ color: "#3B6B70", fontWeight: 700, textDecoration: "none" }}>← Reset</a>
        <h1 style={{ fontSize: 26, margin: "18px 0 4px" }}>Terms</h1>
        <div style={{ color: "#5F7076", fontSize: 13 }}>Last updated {UPDATED}</div>

        <h2 style={h2}>The service</h2>
        <p>Reset helps you take the smallest next step on something you're avoiding, through WhatsApp. It is a focus tool, not medical, psychological or professional advice. If you're in crisis, contact a professional or local emergency services.</p>

        <h2 style={h2}>Trial and price</h2>
        <p>The first 7 days are free, once per number. After that Reset costs 29 AED per month or 249 AED per year, charged by Stripe until you cancel. Prices include any VAT that applies.</p>

        <h2 style={h2}>Cancelling</h2>
        <p>Send "cancel" on WhatsApp for your subscription link, and cancel there at any time. You keep access until the end of the period you paid for. Payments already made aren't refunded unless the law requires it.</p>

        <h2 style={h2}>Fair use</h2>
        <p>Don't use Reset to send spam, abuse, or anything illegal. We can stop access for misuse.</p>

        <h2 style={h2}>Changes</h2>
        <p>If these terms or the price change, we'll tell you on WhatsApp before it applies to you.</p>

        <h2 style={h2}>Contact</h2>
        <p>
          Questions: <Contact />.
        </p>
      </div>
    </div>
  );
}

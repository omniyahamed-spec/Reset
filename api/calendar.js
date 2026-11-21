// GET /api/calendar?h=14&m=30 -> a daily recurring "Reset" event (.ics).
// Served as a real file so iPhone Safari opens it straight in Calendar.
// Floating local time: the event fires at h:m on the user's own clock.
module.exports = (req, res) => {
  const clamp = (v, max, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : d;
  };
  const h = clamp(req.query.h, 23, 12);
  const m = clamp(req.query.m, 59, 0);
  const pad = (n) => String(n).padStart(2, "0");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "reset-cjii.vercel.app";
  const link = `https://${host}/?src=reminder`;

  const now = new Date();
  // d = first day in the user's local calendar (YYYYMMDD), sent by the app.
  let date = /^\d{8}$/.test(String(req.query.d || "")) ? String(req.query.d) : "";
  if (!date) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    date = `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
  }
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reset//Daily reset//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:reset-daily-${Date.now()}@${host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${date}T${pad(h)}${pad(m)}00`,
    "DURATION:PT5M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Reset — 1 minute",
    `DESCRIPTION:Pause. Name the freeze. Move.\\n${link}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reset — 1 minute",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="reset-daily.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(ics);
};

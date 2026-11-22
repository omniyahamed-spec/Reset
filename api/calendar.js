// GET /api/calendar?h=14&m=30 -> a daily recurring "Reset" event (.ics).
// GET /api/calendar?k=day&h=8&m=30&eh=18&em=30 -> two daily events:
//   morning check-in (opens /?src=reminder&do=checkin) and
//   evening check-out (opens /?src=reminder&do=checkout).
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

  const event = (uid, hh, mm, summary, description, url) => [
    "BEGIN:VEVENT",
    `UID:${uid}-${Date.now()}@${host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${date}T${pad(hh)}${pad(mm)}00`,
    "DURATION:PT5M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}\\n${url}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "END:VALARM",
    "END:VEVENT",
  ];

  const events =
    req.query.k === "day"
      ? [
          ...event("reset-checkin", h, m, "Reset — check in (20 sec)", "One thing that matters today. Then 2 minutes on it.", `${link}&do=checkin`),
          ...event(
            "reset-checkout",
            clamp(req.query.eh, 23, 18),
            clamp(req.query.em, 59, 30),
            "Reset — close the day (10 sec)",
            "Did your one thing move? Set tomorrow's.",
            `${link}&do=checkout`
          ),
        ]
      : event("reset-daily", h, m, "Reset — 1 minute", "Pause. Name the freeze. Move.", link);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reset//Daily reset//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="reset-daily.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(ics);
};

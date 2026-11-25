// Go-live status page: /api/status?key=CRON_SECRET  (add &format=json for JSON)
// Before CRON_SECRET is set, it shows only which env vars are missing (no network calls).
const { rest } = require("./_lib/db");
const { runStatus, renderHtml } = require("./_lib/status");

module.exports = async (req, res) => {
  const q = req.query || {};
  const secret = process.env.CRON_SECRET;
  if (secret && q.key !== secret) return res.status(401).send("Add ?key=<your CRON_SECRET>");
  const report = await runStatus(process.env, { fetch, rest }, !!secret);
  res.setHeader("Cache-Control", "no-store");
  if (q.format === "json") return res.status(200).json(report);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(renderHtml(report));
};

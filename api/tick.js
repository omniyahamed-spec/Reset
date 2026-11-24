// Called every minute by Supabase pg_cron (see supabase/migrations/20261122_whatsapp.sql).
// Sends due 5-minute follow-ups, the trial-ending reminder and the morning nudge.
const { db } = require("./_lib/db");
const { wa } = require("./_lib/wa");
const { tick } = require("./_lib/flow");

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || req.headers["x-cron-key"];
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return res.status(401).send("Unauthorized");
  try {
    res.status(200).json(await tick({ db, wa }));
  } catch (e) {
    console.error("tick failed", e.message);
    res.status(500).send("error");
  }
};

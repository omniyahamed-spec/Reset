// GET /api/validation?token=...&since=YYYY-MM-DD&exclude=id1,id2[&format=json]
// Live 10-user validation scorecard, scored against the pre-committed bars
// in the "Reset — 10-User Validation Kit":
//   Bar 1  moved-after-reset >= 60%  (5-min follow-up "Still done")
//   Bar 2  >= 5 of 10 users with 3+ resets (unprompted, when `source` exists)
//   Bar 3  Sean Ellis >= 4/10 "very disappointed" — survey, entered by hand
// Read-only. Needs Vercel env vars:
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase > Project Settings > API > service_role)
//   VALIDATION_TOKEN           (any long random string; the page's password)
//   SUPABASE_URL or REACT_APP_SUPABASE_URL
const crypto = require("crypto");

const BARS = { movedRate: 60, usersWith3: 5, cohort: 10 };

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function fetchAll(base, key, table, query) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const r = await fetch(`${base}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + page - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function score(entries, profiles) {
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  const hasSource = entries.some((e) => "source" in e);
  const byUser = {};
  for (const e of entries) {
    const u = (byUser[e.profile_id] ||= { id: e.profile_id, resets: 0, unprompted: 0, prompted: 0, confirmed: 0, slipped: 0, days: new Set(), first: e.created_at, last: e.created_at });
    u.resets++;
    if (hasSource) {
      if (e.source === "organic") u.unprompted++;
      else if (e.source) u.prompted++;
    }
    if (e.follow_up === "confirmed") u.confirmed++;
    if (e.follow_up === "slipped") u.slipped++;
    u.days.add(String(e.created_at).slice(0, 10));
    if (e.created_at < u.first) u.first = e.created_at;
    if (e.created_at > u.last) u.last = e.created_at;
  }
  const users = Object.values(byUser).map((u) => {
    const answered = u.confirmed + u.slipped;
    const span = (new Date(u.last) - new Date(u.first)) / 86400000;
    return {
      id: u.id,
      name: names[u.id] || "(no name)",
      resets: u.resets,
      unprompted: hasSource ? u.unprompted : null,
      activeDays: u.days.size,
      confirmed: u.confirmed,
      slipped: u.slipped,
      unanswered: u.resets - answered,
      movedRate: answered ? Math.round((100 * u.confirmed) / answered) : null,
      first: u.first,
      last: u.last,
      cameBackAfter7d: span >= 7,
    };
  }).sort((a, b) => b.resets - a.resets);

  const confirmed = users.reduce((s, u) => s + u.confirmed, 0);
  const answered = users.reduce((s, u) => s + u.confirmed + u.slipped, 0);
  const total = users.reduce((s, u) => s + u.resets, 0);
  const movedRate = answered ? Math.round((100 * confirmed) / answered) : null;
  const countKey = hasSource ? "unprompted" : "resets";
  const usersWith3 = users.filter((u) => (u[countKey] || 0) >= 3).length;

  const bar1 = movedRate === null ? "no data" : movedRate >= BARS.movedRate ? "pass" : "fail";
  const bar2 = usersWith3 >= BARS.usersWith3 ? "pass" : users.length < BARS.cohort ? "in progress" : "fail";
  return {
    generatedAt: new Date().toISOString(),
    cohortSize: users.length,
    totalResets: total,
    followUpAnswerRate: total ? Math.round((100 * answered) / total) : null,
    bar1: { label: "Moved after reset (5-min check) ≥ 60%", value: movedRate, basis: `${confirmed}/${answered} answered follow-ups`, status: bar1 },
    bar2: { label: `≥ 5 users with 3+ ${hasSource ? "unprompted " : ""}resets`, value: usersWith3, basis: hasSource ? "source = organic" : "source column missing — counting all resets", status: bar2 },
    bar3: { label: "Sean Ellis ≥ 4/10 “very disappointed”", value: null, basis: "survey — record in the Validation Kit tracker", status: "manual" },
    users,
  };
}

function page(s, q) {
  const pill = (st) => {
    const c = { pass: "#0f7b5f", fail: "#b3261e", "in progress": "#8a6d00", "no data": "#666", manual: "#555" }[st];
    return `<span style="background:${c};color:#fff;border-radius:99px;padding:2px 10px;font-size:13px">${esc(st)}</span>`;
  };
  const bar = (b) => `<div class="card"><div class="lbl">${esc(b.label)}</div><div class="big">${b.value === null ? "—" : esc(b.value)}${b === s.bar1 && b.value !== null ? "%" : ""}</div><div class="sub">${esc(b.basis)}</div>${pill(b.status)}</div>`;
  const d = (t) => esc(String(t).slice(0, 10));
  const rows = s.users.map((u) => `<tr><td>${esc(u.name)}<div class="id">${esc(u.id).slice(0, 8)}</div></td><td>${u.resets}</td><td>${u.unprompted ?? "—"}</td><td>${u.activeDays}</td><td>${u.movedRate === null ? "—" : u.movedRate + "%"}</td><td>${u.unanswered}</td><td>${d(u.first)}</td><td>${d(u.last)}</td><td>${u.cameBackAfter7d ? "yes" : "no"}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Reset validation</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f7f7f5;color:#1b1b1b}h1{font-size:20px;margin:0 0 4px}.meta{color:#666;font-size:13px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}.card{background:#fff;border:1px solid #e3e3df;border-radius:12px;padding:14px}
.lbl{font-size:13px;color:#444}.big{font-size:32px;font-weight:700;margin:6px 0}.sub{font-size:12px;color:#777;margin-bottom:8px}
.wrap{overflow-x:auto;background:#fff;border:1px solid #e3e3df;border-radius:12px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee;white-space:nowrap}th{font-size:12px;color:#666}.id{font-size:11px;color:#999}</style></head>
<body><h1>Reset — 10-user validation</h1><div class="meta">${s.cohortSize} users · ${s.totalResets} resets · follow-up answered on ${s.followUpAnswerRate ?? "—"}% · ${q.since ? "since " + esc(q.since) + " · " : ""}updated ${esc(s.generatedAt.slice(0, 16).replace("T", " "))} UTC</div>
<div class="grid">${bar(s.bar1)}${bar(s.bar2)}${bar(s.bar3)}</div>
<div class="wrap"><table><thead><tr><th>User</th><th>Resets</th><th>Unprompted</th><th>Active days</th><th>Moved</th><th>No answer</th><th>First</th><th>Last</th><th>Back after 7d</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No resets yet.</td></tr>'}</tbody></table></div>
<p class="meta">Add <code>&amp;since=YYYY-MM-DD</code> to start the count at test day 0, and <code>&amp;exclude=ID1,ID2</code> (first 8 chars ok) to drop your own test profiles. <code>&amp;format=json</code> for raw numbers.</p></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const expected = process.env.VALIDATION_TOKEN;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
  if (!expected || !key || !base) {
    res.status(503).send("Not configured: set VALIDATION_TOKEN, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in Vercel.");
    return;
  }
  const q = req.query || {};
  if (!safeEqual(q.token, expected)) {
    res.status(401).send("Unauthorized");
    return;
  }
  try {
    const since = /^\d{4}-\d{2}-\d{2}$/.test(String(q.since || "")) ? String(q.since) : "";
    const exclude = String(q.exclude || "").split(",").map((x) => x.trim()).filter(Boolean);
    let entries = await fetchAll(base, key, "entries", `select=*&order=created_at.asc${since ? `&created_at=gte.${since}` : ""}`);
    entries = entries.filter((e) => !exclude.some((x) => String(e.profile_id).startsWith(x)));
    const ids = [...new Set(entries.map((e) => e.profile_id))];
    const profiles = ids.length
      ? await fetchAll(base, key, "profiles", `select=id,name&id=in.(${ids.map((i) => `"${String(i).replace(/"/g, "")}"`).join(",")})`)
      : [];
    const s = score(entries, profiles);
    if (q.format === "json") {
      res.status(200).json(s);
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(page(s, { since }));
  } catch (err) {
    res.status(500).send(`Error: ${esc(err.message)}`);
  }
};

module.exports.score = score;

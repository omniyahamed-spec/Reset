// Go-live self-check: which setup steps are done, which are not, and the WhatsApp funnel.
// Pure function (env, fetch and rest are injected) so tests can run without any account.
// Never returns secrets or phone numbers: only yes/no, names and counts.

const GRAPH = (env) => `https://graph.facebook.com/${env.WHATSAPP_API_VERSION || "v25.0"}`;

const ENV_STEPS = [
  ["SUPABASE_SERVICE_ROLE_KEY", "4. Vercel", "Supabase → Settings → API → service_role"],
  ["CRON_SECRET", "4. Vercel", "any long random string (same one as in the pg_cron SQL)"],
  ["WHATSAPP_TOKEN", "2. Meta", "System User token (the temporary one dies after 24h)"],
  ["WHATSAPP_PHONE_NUMBER_ID", "2. Meta", "WhatsApp → API Setup → Phone number ID"],
  ["WHATSAPP_VERIFY_TOKEN", "2. Meta", "your phrase; same in Meta → Webhook"],
  ["WHATSAPP_APP_SECRET", "2. Meta", "App settings → Basic → App secret"],
  ["REACT_APP_WHATSAPP_NUMBER", "4. Vercel", "digits only, e.g. 9715XXXXXXXX — the landing shows 'Opening soon' without it"],
  ["PAY_LINK_MONTHLY", "3. Stripe", "Payment Link for 29 AED / month"],
  ["PAY_LINK_YEARLY", "3. Stripe", "Payment Link for 249 AED / year"],
  ["STRIPE_WEBHOOK_SECRET", "3. Stripe", "Developers → Webhooks → signing secret (whsec_…)"],
  ["STRIPE_PORTAL_URL", "3. Stripe", "Customer portal login link"],
  ["WHATSAPP_NUDGE_TEMPLATE", "Templates", "reset_daily_reminder, after Meta approves it"],
  ["WHATSAPP_TRIAL_TEMPLATE", "Templates", "reset_trial_ending, after Meta approves it — without it the trial-ending message can't be sent"],
  ["WHATSAPP_BUSINESS_ACCOUNT_ID", "Optional", "WhatsApp → API Setup → WhatsApp Business Account ID (lets this page check templates + webhook subscription)"],
];

const check = (name, ok, fix, info) => ({ name, ok: !!ok, ...(ok ? {} : { fix }), ...(info ? { info } : {}) });

async function graphGet(fetchFn, env, path) {
  const res = await fetchFn(`${GRAPH(env)}/${path}`, { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body.error && body.error.message) || `HTTP ${res.status}`);
  return body;
}

/**
 * @param env  process.env-like object
 * @param deps { fetch, rest, now }  rest = Supabase REST helper from db.js
 * @param live false = only look at env vars (no network)
 */
async function runStatus(env, deps, live = true) {
  const now = deps.now || new Date();
  const checks = [];

  for (const [key, step, where] of ENV_STEPS) {
    checks.push({ ...check(`env ${key}`, !!env[key], `${step}: set ${key} — ${where}`), step });
  }
  const val = (k) => String(env[k] || "");
  if (env.PAY_LINK_MONTHLY || env.PAY_LINK_YEARLY) {
    const bad = ["PAY_LINK_MONTHLY", "PAY_LINK_YEARLY"].filter((k) => env[k] && !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(val(k)));
    checks.push(check("Stripe links look like Payment Links", !bad.length, `${bad.join(", ")} should start with https://buy.stripe.com/`));
  }
  if (env.STRIPE_WEBHOOK_SECRET) {
    checks.push(check("Stripe webhook secret format", val("STRIPE_WEBHOOK_SECRET").startsWith("whsec_"), "STRIPE_WEBHOOK_SECRET should start with whsec_ (it's the endpoint's signing secret, not the API key)"));
  }
  if (env.PAY_LINK_MONTHLY && /\/test_/.test(val("PAY_LINK_MONTHLY"))) {
    checks.push(check("Stripe in live mode", false, "PAY_LINK_MONTHLY is a test-mode link: nobody can really pay yet. Switch Stripe to live mode and make live Payment Links."));
  }
  if (env.REACT_APP_WHATSAPP_NUMBER) {
    checks.push(check("WhatsApp number format", /^\d{8,15}$/.test(val("REACT_APP_WHATSAPP_NUMBER")), "REACT_APP_WHATSAPP_NUMBER: digits only, country code first, no + or spaces; then Redeploy"));
  }

  const funnel = {};
  if (!live) return summarize(checks, funnel, now);

  // Supabase tables (step 1) + funnel counts.
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const users = await deps.rest("wa_users?select=sub_status,lang,created_at,last_inbound_at,followup_due_at,trial_ends_at");
      checks.push(check("Supabase table wa_users", true));
      const day = 864e5;
      const count = (f) => users.filter(f).length;
      Object.assign(funnel, {
        whatsapp_users: users.length,
        joined_last_7d: count((u) => now - new Date(u.created_at) < 7 * day),
        active_last_7d: count((u) => u.last_inbound_at && now - new Date(u.last_inbound_at) < 7 * day),
        in_trial: count((u) => u.sub_status === "trial" && u.trial_ends_at && new Date(u.trial_ends_at) > now),
        trial_ended_unpaid: count((u) => u.sub_status === "trial" && u.trial_ends_at && new Date(u.trial_ends_at) <= now),
        paying: count((u) => u.sub_status === "active"),
        canceled: count((u) => u.sub_status === "canceled"),
        arabic: count((u) => u.lang === "ar"),
      });
      funnel.mrr_aed_if_all_monthly = funnel.paying * 29;
      // A follow-up due more than 3 minutes ago means pg_cron isn't calling /api/tick.
      const stuck = count((u) => u.followup_due_at && now - new Date(u.followup_due_at) > 3 * 60e3);
      checks.push(check("Every-minute tick is running", stuck === 0, `1. Supabase: ${stuck} follow-up(s) overdue — run the pg_cron SQL in docs/WHATSAPP_SETUP.md with the same CRON_SECRET as Vercel`));
    } catch (e) {
      checks.push(check("Supabase table wa_users", false, `1. Supabase: run supabase/migrations/20261122_whatsapp.sql (${short(e)})`));
    }
    try {
      // Who brought whom: outreach links ?ref=<name> -> wa_users.ref. Joined / paying per ref.
      const refs = await deps.rest("wa_users?select=ref,sub_status");
      const by = {};
      refs.forEach((u) => {
        const k = u.ref || "(direct)";
        by[k] = by[k] || { joined: 0, paying: 0 };
        by[k].joined++;
        if (u.sub_status === "active") by[k].paying++;
      });
      funnel.by_ref = Object.entries(by)
        .sort((a, b) => b[1].joined - a[1].joined)
        .map(([k, v]) => `${k}: ${v.joined} joined, ${v.paying} paying`)
        .join(" · ") || "none yet";
    } catch (e) {
      checks.push(check("wa_users.ref column", false, `1. Supabase: run supabase/migrations/20261125_wa_ref.sql (${short(e)})`));
    }
    try {
      await deps.rest("wa_trial_used?select=phone_hash&limit=1");
      checks.push(check("Supabase table wa_trial_used", true));
    } catch (e) {
      checks.push(check("Supabase table wa_trial_used", false, `1. Supabase: run the full 20261122_whatsapp.sql again (it's safe to re-run) (${short(e)})`));
    }
    try {
      const since = new Date(now - 7 * 864e5).toISOString();
      const rows = await deps.rest(`entries?source=eq.whatsapp&created_at=gte.${encodeURIComponent(since)}&select=follow_up`);
      funnel.resets_last_7d = rows.length;
      funnel.moved_after_reset = rows.filter((r) => r.follow_up === "confirmed").length;
    } catch (e) {
      checks.push(check("entries.source column", false, `1. Supabase: run supabase/migrations/20261121_entries_source.sql (${short(e)})`));
    }
  }

  // Meta: token + phone number.
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const p = await graphGet(deps.fetch, env, `${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,name_status,quality_rating`);
      checks.push(check("Meta token + phone number", true, null, `${p.verified_name || "?"} (${p.display_phone_number || "?"}), quality ${p.quality_rating || "?"}, name ${p.name_status || "?"}`));
      const digits = String(p.display_phone_number || "").replace(/\D/g, "");
      if (env.REACT_APP_WHATSAPP_NUMBER && digits) {
        checks.push(check("Landing number = Meta number", digits === val("REACT_APP_WHATSAPP_NUMBER"), `REACT_APP_WHATSAPP_NUMBER is not the number Meta sends from (${digits}). Fix it in Vercel and Redeploy, or the landing button opens the wrong chat.`));
      }
      if (/test/i.test(p.verified_name || "") || /^1555/.test(digits)) {
        checks.push(check("Real number (not Meta's test number)", false, "This is Meta's test number: it can only message up to 5 numbers you add by hand. Add a real number in WhatsApp Manager before recruiting."));
      }
    } catch (e) {
      checks.push(check("Meta token + phone number", false, `2. Meta: token expired or wrong phone number ID — make a System User token (${short(e)})`));
    }
  }

  // Meta: templates + webhook subscription (needs the WABA id).
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    const waba = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    try {
      const t = await graphGet(deps.fetch, env, `${waba}/message_templates?fields=name,status,language,category&limit=100`);
      const list = t.data || [];
      for (const name of ["reset_daily_reminder", "reset_trial_ending"]) {
        for (const lang of ["en", "ar"]) {
          const hit = list.find((x) => x.name === name && (x.language === lang || x.language.startsWith(lang + "_")));
          const st = hit ? hit.status : "NOT SUBMITTED";
          const cat = hit && hit.category && hit.category !== "UTILITY" ? ` — re-categorised ${hit.category} (costs ~3x)` : "";
          checks.push(check(`Template ${name} (${lang})`, st === "APPROVED" && !cat, `Templates: ${st}${cat} — see docs/WHATSAPP_TEMPLATES.md`, hit ? `${st}${cat}` : undefined));
        }
      }
    } catch (e) {
      checks.push(check("Message templates", false, `Templates: couldn't read (${short(e)}) — check WHATSAPP_BUSINESS_ACCOUNT_ID`));
    }
    try {
      const s = await graphGet(deps.fetch, env, `${waba}/subscribed_apps`);
      checks.push(check("App subscribed to the WhatsApp account", (s.data || []).length > 0, "2. Meta: messages won't arrive. In WhatsApp → Configuration, subscribe the webhook to the 'messages' field"));
    } catch (e) {
      checks.push(check("App subscribed to the WhatsApp account", false, `2. Meta: couldn't check (${short(e)})`));
    }
  }

  return summarize(checks, funnel, now);
}

const short = (e) => String((e && e.message) || e).slice(0, 140);

function summarize(checks, funnel, now) {
  const failing = checks.filter((c) => !c.ok);
  const blocking = failing.filter((c) => !/^env (WHATSAPP_BUSINESS_ACCOUNT_ID|WHATSAPP_NUDGE_TEMPLATE)$/.test(c.name));
  return {
    checked_at: now.toISOString(),
    ready_for_real_users: blocking.length === 0,
    done: checks.length - failing.length,
    total: checks.length,
    next_step: failing[0] ? failing[0].fix : "All set: message the number from your phone, then send the recruiting messages.",
    checks,
    funnel,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderHtml(r) {
  const rows = r.checks
    .map((c) => `<tr><td>${c.ok ? "✅" : "❌"}</td><td>${esc(c.name)}${c.info ? `<div class=i>${esc(c.info)}</div>` : ""}${c.fix ? `<div class=f>${esc(c.fix)}</div>` : ""}</td></tr>`)
    .join("");
  const funnel = Object.keys(r.funnel).length
    ? `<h2>WhatsApp funnel</h2><table>${Object.entries(r.funnel).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>`
    : "";
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>Reset — go-live status</title>
<style>body{font:15px/1.45 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:16px;color:#1d1b2e;background:#fafafc}h1{font-size:20px}h2{font-size:16px;margin-top:28px}table{border-collapse:collapse;width:100%}td{padding:8px 6px;border-bottom:1px solid #e6e4ef;vertical-align:top}.f{color:#a33;font-size:13px;margin-top:2px}.i{color:#666;font-size:13px}.b{padding:12px;border-radius:10px;background:${r.ready_for_real_users ? "#e3f6ec" : "#fdeeee"}}</style>
<h1>Reset — go-live status</h1>
<p class=b><b>${r.ready_for_real_users ? "Ready for real users." : "Not ready yet."}</b> ${r.done}/${r.total} checks pass.<br>Next: ${esc(r.next_step)}</p>
<table>${rows}</table>${funnel}
<p class=i>Checked ${esc(r.checked_at)}. JSON: add &amp;format=json. Shows no secrets or phone numbers.</p>`;
}

module.exports = { runStatus, renderHtml, ENV_STEPS };

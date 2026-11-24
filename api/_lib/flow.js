// The Reset conversation on WhatsApp. Pure logic: all I/O goes through deps
// ({ db, wa }) so it can be tested without Meta, Stripe or Supabase.
const crypto = require("crypto");
const { OPTIONS, T, detectLang, CANCEL_WORDS, HELP_WORDS, DELETE_WORDS } = require("./copy");

const TRIAL_DAYS = 7;
const FOLLOWUP_MIN = 5;
const DAY = 24 * 60 * 60 * 1000;
const DUBAI_OFFSET_H = 4; // UTC+4, no DST

const phoneHash = (phone) => crypto.createHash("sha256").update("trial:" + String(phone)).digest("hex");

const profileIdFor = (phone) =>
  "wa_" + crypto.createHash("sha256").update(String(phone)).digest("hex").slice(0, 20);

function payLinks(user) {
  const add = (url) => (url ? `${url}${url.includes("?") ? "&" : "?"}client_reference_id=${user.profile_id}` : "(link coming soon)");
  return { monthly: add(process.env.PAY_LINK_MONTHLY), yearly: add(process.env.PAY_LINK_YEARLY) };
}

const entitled = (user, now) =>
  user.sub_status === "active" || (user.trial_ends_at && now < new Date(user.trial_ends_at));

const within24h = (user, now) => user.last_inbound_at && now - new Date(user.last_inbound_at) < DAY;

/** Up to 2 of the user's own answers used 2+ times that aren't already options (as in the app). */
function learned(past, defaults) {
  const counts = {};
  past.forEach((p) => {
    const v = (p || "").trim();
    if (v && !defaults.includes(v) && v.length <= 40) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([v]) => v);
}

const STEP = {
  ask_mind: { key: "mind", field: "mind", next: "ask_avoid" },
  ask_avoid: { key: "avoid", field: "avoiding", next: "ask_move" },
  ask_move: { key: "move", field: "move", next: null },
};
const PROMPT = { ask_mind: "askMind", ask_avoid: "askAvoid", ask_move: "askMove" };

async function sendStep(deps, user, state) {
  const t = T[user.lang];
  const { key, field } = STEP[state];
  const defaults = OPTIONS[key][user.lang];
  const past = (await deps.db.pastAnswers(user.profile_id)).map((e) => e[field]);
  const rows = [...learned(past, defaults), ...defaults].map((v) => ({ id: `opt:${v}`, title: v }));
  rows.push({ id: "type", title: t.typeOwn });
  await deps.wa.list(user.phone, t[PROMPT[state]], t.listButton, rows);
}

async function startReset(deps, user) {
  user = await deps.db.updateUser(user.phone, { state: "ask_mind", draft: {} });
  await sendStep(deps, user, "ask_mind");
}

async function sendPaywall(deps, user, now) {
  // At most once an hour, so a paused user isn't spammed.
  if (user.paywall_sent_at && now - new Date(user.paywall_sent_at) < 60 * 60 * 1000) return;
  const { monthly, yearly } = payLinks(user);
  await deps.wa.text(user.phone, T[user.lang].paywall(monthly, yearly));
  await deps.db.updateUser(user.phone, { paywall_sent_at: now.toISOString() });
}

async function answerFollowup(deps, user, entryId, answer, now) {
  await deps.db.updateEntry(entryId, { follow_up: answer, follow_up_at: now.toISOString() });
  await deps.db.updateUser(user.phone, { followup_due_at: null, followup_entry_id: null });
  const t = T[user.lang];
  if (answer === "confirmed") {
    const kept = (await deps.db.pastAnswers(user.profile_id)).filter((e) => e.follow_up === "confirmed").length;
    await deps.wa.text(user.phone, t.doneReply(Math.max(kept, 1)));
  } else {
    await deps.wa.text(user.phone, t.slippedReply);
  }
}

/**
 * msg: { kind: "text" | "reply" | "voice" | "other", text?: string, id?: string }
 */
async function handleInbound(deps, { phone, name, msg, now = new Date() }) {
  const text = (msg.text || "").trim();
  const lower = text.toLowerCase();
  let user = await deps.db.getUser(phone);

  if (!user) {
    const profile_id = profileIdFor(phone);
    const hadTrial = deps.db.trialUsed ? await deps.db.trialUsed(phoneHash(phone)) : false;
    await deps.db.ensureProfile(profile_id, name);
    user = await deps.db.createUser({
      phone,
      profile_id,
      name: name || null,
      lang: detectLang(text),
      state: "idle",
      draft: {},
      sub_status: "trial",
      trial_ends_at: new Date(now.getTime() + (hadTrial ? 0 : TRIAL_DAYS) * DAY).toISOString(),
      last_inbound_at: now.toISOString(),
      nudge_hour: 9,
    });
    if (hadTrial) {
      await deps.wa.text(phone, T[user.lang].welcomeBack);
      return sendPaywall(deps, user, now);
    }
    await deps.wa.text(phone, T[user.lang].welcome);
    if (msg.kind === "voice") await deps.wa.text(phone, T[user.lang].voice);
    return startReset(deps, user);
  }

  user = await deps.db.updateUser(phone, { last_inbound_at: now.toISOString() });
  const t = () => T[user.lang];

  // Commands work in any state.
  if (["عربي", "arabic"].includes(lower)) {
    user = await deps.db.updateUser(phone, { lang: "ar" });
    return deps.wa.text(phone, t().switched);
  }
  if (["english", "انجليزي", "إنجليزي"].includes(lower)) {
    user = await deps.db.updateUser(phone, { lang: "en" });
    return deps.wa.text(phone, t().switched);
  }
  if (CANCEL_WORDS.includes(lower)) {
    const url = process.env.STRIPE_PORTAL_URL;
    return deps.wa.text(phone, url ? t().manage(url) : t().manageMissing);
  }
  if (HELP_WORDS.includes(lower)) return deps.wa.text(phone, t().help);
  if (DELETE_WORDS.includes(lower)) {
    return deps.wa.buttons(phone, t().deleteAsk, [
      { id: "del:yes", title: t().deleteYes },
      { id: "del:no", title: t().deleteNo },
    ]);
  }
  if (msg.kind === "reply" && msg.id === "del:no") return deps.wa.text(phone, t().deleteKept);
  if (msg.kind === "reply" && msg.id === "del:yes") {
    const copy = t();
    const paid = user.sub_status === "active" && process.env.STRIPE_PORTAL_URL;
    if (deps.db.markTrialUsed) await deps.db.markTrialUsed(phoneHash(phone));
    await deps.db.deleteUserData(phone, user.profile_id);
    return deps.wa.text(phone, paid ? copy.deletedPaid(process.env.STRIPE_PORTAL_URL) : copy.deleted);
  }
  if (["no reminders", "بدون تذكير"].includes(lower)) {
    await deps.db.updateUser(phone, { nudge_hour: null });
    return deps.wa.text(phone, "OK. No morning reminders. / تم. بدون تذكير صباحي.");
  }

  // 5-minute follow-up answer (works even after the trial ends: it's the user's own data).
  if (msg.kind === "reply" && msg.id && msg.id.startsWith("fu:")) {
    const [, answer, entryId] = msg.id.split(":");
    return answerFollowup(deps, user, entryId, answer, now);
  }

  if (msg.kind === "voice") return deps.wa.text(phone, t().voice);

  // "See plans" tap on the trial-ending template.
  if (msg.kind === "reply" && msg.id === "plans") {
    if (user.sub_status === "active") return deps.wa.text(phone, t().activated);
    if (entitled(user, now)) {
      const { monthly, yearly } = payLinks(user);
      return deps.wa.text(phone, t().plans(monthly, yearly));
    }
    return sendPaywall(deps, user, now);
  }

  if (!entitled(user, now)) return sendPaywall(deps, user, now);

  const step = STEP[user.state];
  if (!step || (msg.kind === "reply" && msg.id === "start")) return startReset(deps, user);

  if (msg.kind === "reply" && msg.id === "type") return deps.wa.text(phone, t().typeIt);

  const answer = msg.kind === "reply" && msg.id && msg.id.startsWith("opt:") ? msg.id.slice(4) : text;
  if (!answer) return sendStep(deps, user, user.state);

  const draft = { ...(user.draft || {}), [step.field]: answer.slice(0, 120) };

  if (step.next) {
    user = await deps.db.updateUser(phone, { state: step.next, draft });
    return sendStep(deps, user, step.next);
  }

  // Last tap: save the reset, send them off, schedule the 5-minute check.
  const base = { profile_id: user.profile_id, mind: draft.mind, avoiding: draft.avoiding, move: draft.move, status: "done", feedback: "" };
  let entry;
  try {
    entry = await deps.db.insertEntry({ ...base, source: "whatsapp" });
  } catch (e) {
    entry = await deps.db.insertEntry(base); // older table without `source`
  }
  await deps.db.updateUser(phone, {
    state: "idle",
    draft: {},
    followup_due_at: new Date(now.getTime() + FOLLOWUP_MIN * 60 * 1000).toISOString(),
    followup_entry_id: entry && entry.id ? String(entry.id) : null,
  });
  return deps.wa.text(phone, t().go(draft.move));
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};
/** "25 Nov" / "25 نوفمبر" in Dubai time — the {{1}} of the trial-ending template. */
function dubaiDay(iso, lang) {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_H * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[lang === "ar" ? "ar" : "en"][d.getUTCMonth()]}`;
}

const dubaiDate = (now) => new Date(now.getTime() + DUBAI_OFFSET_H * 3600 * 1000);

/** Runs every minute: 5-minute follow-ups, trial-ending reminder, morning nudge. */
async function tick(deps, now = new Date()) {
  const sent = { followups: 0, trialReminders: 0, nudges: 0 };

  for (const user of await deps.db.dueFollowups(now.toISOString())) {
    const t = T[user.lang];
    await deps.db.updateUser(user.phone, { followup_due_at: null });
    if (!user.followup_entry_id) continue;
    await deps.wa.buttons(user.phone, t.followup, [
      { id: `fu:confirmed:${user.followup_entry_id}`, title: t.stillDone },
      { id: `fu:slipped:${user.followup_entry_id}`, title: t.slipped },
    ]);
    sent.followups++;
  }

  const local = dubaiDate(now);
  const today = local.toISOString().slice(0, 10);
  for (const user of await deps.db.allUsers()) {
    const t = T[user.lang];
    const open = within24h(user, now);

    // One reminder the day before the trial ends.
    const left = user.trial_ends_at ? new Date(user.trial_ends_at) - now : -1;
    if (user.sub_status === "trial" && !user.trial_reminded && left > 0 && left <= DAY) {
      let delivered = true;
      if (open) {
        await deps.wa.text(user.phone, t.trialEnding(payLinks(user).monthly));
      } else if (process.env.WHATSAPP_TRIAL_TEMPLATE) {
        // No links in the template (keeps it utility); the "See plans" tap opens a free 24h window.
        await deps.wa.template(user.phone, process.env.WHATSAPP_TRIAL_TEMPLATE, user.lang, {
          body: [dubaiDay(user.trial_ends_at, user.lang)],
          buttons: ["plans"],
        });
      } else {
        delivered = false; // try again next minute, e.g. once they message us
      }
      if (delivered) {
        await deps.db.updateUser(user.phone, { trial_reminded: true });
        sent.trialReminders++;
      }
    }

    // Morning nudge at the user's hour (Dubai time), once a day, only while they have access.
    if (user.nudge_hour !== null && user.nudge_hour !== undefined && local.getUTCHours() === user.nudge_hour &&
        user.last_nudge_on !== today && entitled(user, now)) {
      if (open) {
        await deps.wa.buttons(user.phone, t.nudge, [{ id: "start", title: t.startButton }]);
      } else if (process.env.WHATSAPP_NUDGE_TEMPLATE) {
        await deps.wa.template(user.phone, process.env.WHATSAPP_NUDGE_TEMPLATE, user.lang, { buttons: ["start"] });
      } else {
        continue;
      }
      await deps.db.updateUser(user.phone, { last_nudge_on: today });
      sent.nudges++;
    }
  }
  return sent;
}

/** Stripe → subscription status. Returns what changed (for logs/tests). */
async function applyStripeEvent(deps, event) {
  const o = event.data && event.data.object;
  if (!o) return "ignored";

  if (event.type === "checkout.session.completed") {
    if (!o.client_reference_id) return "no-reference";
    const user = await deps.db.getUserByProfile(o.client_reference_id);
    if (!user) return "unknown-user";
    await deps.db.updateUser(user.phone, {
      sub_status: "active",
      stripe_customer_id: o.customer || null,
      stripe_subscription_id: o.subscription || null,
    });
    await deps.wa.text(user.phone, T[user.lang].activated).catch(() => {}); // outside 24h: skip, access is still on
    return "activated";
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const user = await deps.db.getUserBySubscription(o.id);
    if (!user) return "unknown-subscription";
    const live = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(o.status);
    const status = live ? "active" : "canceled";
    if (status === user.sub_status) return "unchanged";
    await deps.db.updateUser(user.phone, { sub_status: status });
    if (status === "canceled") await deps.wa.text(user.phone, T[user.lang].ended).catch(() => {});
    return status;
  }
  return "ignored";
}

module.exports = { handleInbound, tick, applyStripeEvent, profileIdFor, phoneHash, entitled, learned, dubaiDay, TRIAL_DAYS };

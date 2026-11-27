// WhatsApp flow tests with an in-memory database and a recording sender.
// Run: node tests/whatsapp.test.js   (no Meta, Stripe or Supabase needed)
const assert = require("assert");
const { Readable } = require("stream");
const crypto = require("crypto");
const { handleInbound, tick, applyStripeEvent, dubaiDay, usualHour, TRIAL_DAYS } = require("../api/_lib/flow");
const { normalize } = require("../api/whatsapp");
const { rawBody, metaSignatureOk, stripeSignatureOk } = require("../api/_lib/http");

function memDb() {
  const users = new Map();
  const entries = [];
  const trials = new Set();
  let nextId = 1;
  return {
    users,
    entries,
    async getUser(phone) { return users.get(phone) || null; },
    async getUserByProfile(id) { return [...users.values()].find((u) => u.profile_id === id) || null; },
    async getUserBySubscription(id) { return [...users.values()].find((u) => u.stripe_subscription_id === id) || null; },
    async createUser(u) { users.set(u.phone, { ...u }); return users.get(u.phone); },
    async updateUser(phone, patch) { const u = { ...users.get(phone), ...patch }; users.set(phone, u); return u; },
    async ensureProfile() {},
    async insertEntry(e) { const row = { id: nextId++, ...e }; entries.push(row); return row; },
    async updateEntry(id, patch) { Object.assign(entries.find((e) => String(e.id) === String(id)), patch); },
    async pastAnswers(pid) { return entries.filter((e) => e.profile_id === pid); },
    async dueFollowups(iso) { return [...users.values()].filter((u) => u.followup_due_at && u.followup_due_at <= iso); },
    async allUsers() { return [...users.values()]; },
    async deleteUserData(phone, pid) {
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i].profile_id === pid) entries.splice(i, 1);
      users.delete(phone);
    },
    async trialUsed(h) { return trials.has(h); },
    async markTrialUsed(h) { trials.add(h); },
  };
}

function recorder() {
  const sent = [];
  const push = (type) => async (to, ...args) => { sent.push({ type, to, args }); return {}; };
  return { sent, text: push("text"), list: push("list"), buttons: push("buttons"), template: push("template"), image: push("image") };
}

const PHONE = "971500000001";
const t0 = new Date("2026-11-23T05:00:00Z"); // 09:00 Dubai
const tap = (id) => ({ kind: "reply", id });
const text = (s) => ({ kind: "text", text: s });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("new user gets welcome + first question, on a 7-day trial", async () => {
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, name: "Sara", msg: text("hi"), now: t0 });
  const u = db.users.get(PHONE);
  assert.equal(u.sub_status, "trial");
  assert.equal(new Date(u.trial_ends_at) - t0, TRIAL_DAYS * 864e5);
  assert.equal(wa.sent[0].type, "text");
  assert.equal(wa.sent[1].type, "list");
  assert.equal(u.state, "ask_mind");
});

test("Arabic first message -> Arabic", async () => {
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("مرحبا"), now: t0 });
  assert.equal(db.users.get(PHONE).lang, "ar");
});

test("landing prefill texts: Arabic page -> Arabic bot, English page -> English bot, and the prefill is not saved as an answer", async () => {
  // Must match FIRST_MSG in src/Landing.tsx.
  for (const [first, lang] of [["ابدأ Reset", "ar"], ["Reset", "en"]]) {
    const db = memDb(), wa = recorder();
    await handleInbound({ db, wa }, { phone: PHONE, msg: text(first), now: t0 });
    const u = db.users.get(PHONE);
    assert.equal(u.lang, lang);
    assert.equal(u.state, "ask_mind");
    assert.equal(db.entries.length, 0);
  }
});

test("?ref attribution: [name] in the first message is saved, not treated as an answer; missing column doesn't block joining", async () => {
  const { parseRef } = require("../api/_lib/flow");
  assert.equal(parseRef("Reset [Sara_1]"), "sara_1");
  assert.equal(parseRef("Reset"), null);
  assert.equal(parseRef("Reset [bad name!]"), null);
  // Must match refSuffix in src/Landing.tsx.
  for (const [first, lang] of [["ابدأ Reset [sara]", "ar"], ["Reset [sara]", "en"]]) {
    const db = memDb(), wa = recorder();
    await handleInbound({ db, wa }, { phone: PHONE, msg: text(first), now: t0 });
    const u = db.users.get(PHONE);
    assert.equal(u.ref, "sara");
    assert.equal(u.lang, lang);
    assert.equal(u.state, "ask_mind");
    assert.equal(db.entries.length, 0);
  }
  const db = memDb(), wa = recorder();
  const update = db.updateUser;
  db.updateUser = async (phone, patch) => { if ("ref" in patch) throw new Error("column ref does not exist"); return update(phone, patch); };
  const warn = console.warn; console.warn = () => {};
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("Reset [sara]"), now: t0 });
  console.warn = warn;
  assert.equal(db.users.get(PHONE).state, "ask_mind");
  assert.equal(wa.sent[1].type, "list");
});

test("formal Arabic commands work: إيقاف التذكير, العربية", async () => {
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: t0 });
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("العربية"), now: t0 });
  assert.equal(db.users.get(PHONE).lang, "ar");
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("إيقاف التذكير"), now: t0 });
  assert.equal(db.users.get(PHONE).nudge_hour, null);
});

test("three taps save a whatsapp entry and schedule the 5-minute check", async () => {
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:Work"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:A message"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:Send it"), now: t0 });
  assert.equal(db.entries.length, 1);
  assert.deepEqual(
    { mind: db.entries[0].mind, avoiding: db.entries[0].avoiding, move: db.entries[0].move, source: db.entries[0].source },
    { mind: "Work", avoiding: "A message", move: "Send it", source: "whatsapp" }
  );
  assert.ok(db.users.get(PHONE).followup_due_at);

  const later = new Date(t0.getTime() + 5 * 60e3);
  const out = await tick(d, later);
  assert.equal(out.followups, 1);
  const btn = wa.sent.find((m) => m.type === "buttons" && m.args[1][0].id.startsWith("fu:"));
  assert.ok(btn, "follow-up buttons sent");
  await handleInbound(d, { phone: PHONE, msg: tap(btn.args[1][0].id), now: later });
  assert.equal(db.entries[0].follow_up, "confirmed");
});

test("after the trial: paywall with links carrying the profile id, at most once an hour", async () => {
  process.env.PAY_LINK_MONTHLY = "https://buy.stripe.com/m";
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: t0 });
  const after = new Date(t0.getTime() + 8 * 864e5);
  const n = wa.sent.length;
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: after });
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: after });
  assert.equal(wa.sent.length, n + 1);
  assert.ok(wa.sent[n].args[0].includes("client_reference_id=" + db.users.get(PHONE).profile_id));
});

test("Stripe checkout unlocks, subscription deleted locks", async () => {
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: t0 });
  const pid = db.users.get(PHONE).profile_id;
  assert.equal(await applyStripeEvent(d, { type: "checkout.session.completed", data: { object: { client_reference_id: pid, customer: "cus_1", subscription: "sub_1" } } }), "activated");
  assert.equal(db.users.get(PHONE).sub_status, "active");
  assert.equal(await applyStripeEvent(d, { type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled" } } }), "canceled");
});

test("delete my data: confirm erases everything; re-joining gets no second trial", async () => {
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:Work"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:A call"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: tap("opt:Make the call"), now: t0 });
  await handleInbound(d, { phone: PHONE, msg: text("delete my data"), now: t0 });
  assert.equal(wa.sent[wa.sent.length - 1].type, "buttons");
  await handleInbound(d, { phone: PHONE, msg: tap("del:yes"), now: t0 });
  assert.equal(db.users.size, 0);
  assert.equal(db.entries.length, 0);

  await handleInbound(d, { phone: PHONE, msg: text("hi again"), now: t0 });
  const u = db.users.get(PHONE);
  assert.ok(new Date(u.trial_ends_at) <= t0, "no second free trial");
});

test("morning nudge only inside the 24h window (no template configured)", async () => {
  delete process.env.WHATSAPP_NUDGE_TEMPLATE;
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: new Date("2026-11-22T10:00:00Z") });
  assert.equal((await tick(d, t0)).nudges, 1); // 09:00 Dubai next day, inside 24h
  assert.equal((await tick(d, t0)).nudges, 0); // once a day
  assert.equal((await tick(d, new Date("2026-11-25T05:00:00Z"))).nudges, 0); // window closed
});

test("outside 24h: nudge + trial templates carry button payloads; their taps work", async () => {
  process.env.WHATSAPP_NUDGE_TEMPLATE = "reset_daily_reminder";
  process.env.WHATSAPP_TRIAL_TEMPLATE = "reset_trial_ending";
  process.env.PAY_LINK_MONTHLY = "https://buy.stripe.com/m";
  process.env.PAY_LINK_YEARLY = "https://buy.stripe.com/y";
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  const start = new Date("2026-11-20T06:00:00Z"); // trial ends 27 Nov 10:00 Dubai
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: start });

  const nudgeAt = new Date("2026-11-23T05:00:00Z"); // 09:00 Dubai, 3 days of silence
  assert.equal((await tick(d, nudgeAt)).nudges, 1);
  const nudge = wa.sent[wa.sent.length - 1];
  assert.equal(nudge.type, "template");
  assert.deepEqual(nudge.args.slice(0, 3), ["reset_daily_reminder", "en", { buttons: ["start"] }]);

  // Tap on the template button arrives as a Meta "button" message.
  const tapStart = normalize({ type: "button", button: { payload: "start", text: "Reset now" } });
  await handleInbound(d, { phone: PHONE, msg: tapStart, now: nudgeAt });
  assert.equal(db.users.get(PHONE).state, "ask_mind");

  const dayBefore = new Date("2026-11-26T12:00:00Z"); // 22h before the end, window closed
  assert.equal((await tick(d, dayBefore)).trialReminders, 1);
  const tr = wa.sent.find((m) => m.type === "template" && m.args[0] === "reset_trial_ending");
  assert.deepEqual(tr.args[2], { body: ["27 Nov"], buttons: ["plans"] });
  assert.equal((await tick(d, dayBefore)).trialReminders, 0, "only once");

  await handleInbound(d, { phone: PHONE, msg: tap("plans"), now: dayBefore });
  const reply = wa.sent[wa.sent.length - 1];
  assert.ok(reply.args[0].includes("https://buy.stripe.com/y?client_reference_id="), "plans reply has both links");
});

test("trial reminder is not marked sent when it couldn't be delivered", async () => {
  delete process.env.WHATSAPP_TRIAL_TEMPLATE;
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: new Date("2026-11-20T06:00:00Z") });
  const dayBefore = new Date("2026-11-26T12:00:00Z");
  assert.equal((await tick(d, dayBefore)).trialReminders, 0);
  assert.ok(!db.users.get(PHONE).trial_reminded);
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: dayBefore }); // they write -> window opens
  assert.equal((await tick(d, dayBefore)).trialReminders, 1);
});

test("dubaiDay formats the template date in both languages", async () => {
  assert.equal(dubaiDay("2026-11-30T21:00:00Z", "en"), "1 Dec"); // already 1 Dec in Dubai
  assert.equal(dubaiDay("2026-11-27T06:00:00Z", "ar"), "27 نوفمبر");
});

test("rawBody reads the stream before req.body; signatures check out", async () => {
  const body = JSON.stringify({ a: 1 });
  const req = Readable.from([Buffer.from(body)]);
  Object.defineProperty(req, "body", { get() { throw new Error("body getter touched"); } });
  assert.equal(await rawBody(req), body);

  const sig = "sha256=" + crypto.createHmac("sha256", "s").update(body).digest("hex");
  assert.ok(metaSignatureOk(body, sig, "s"));
  assert.ok(!metaSignatureOk(body, "sha256=bad", "s"));
  const ts = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", "w").update(`${ts}.${body}`).digest("hex");
  assert.ok(stripeSignatureOk(body, `t=${ts},v1=${v1}`, "w"));
});

const { runStatus, renderHtml } = require("../api/_lib/status");

test("status: nothing set -> not ready, first fix names the Vercel step, no network", async () => {
  const r = await runStatus({}, { fetch: () => { throw new Error("no network"); }, rest: () => { throw new Error("no db"); } }, false);
  assert.equal(r.ready_for_real_users, false);
  assert.match(r.next_step, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.ok(renderHtml(r).includes("Not ready yet"));
});

test("status: fully set up -> ready, funnel counts, never leaks secrets or phone numbers", async () => {
  const now = new Date("2026-11-30T10:00:00Z");
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: "srk-ZZLEAK", CRON_SECRET: "c", WHATSAPP_TOKEN: "tok-ZZLEAK", WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_VERIFY_TOKEN: "v", WHATSAPP_APP_SECRET: "a", REACT_APP_WHATSAPP_NUMBER: "971500000009",
    PAY_LINK_MONTHLY: "https://buy.stripe.com/abc", PAY_LINK_YEARLY: "https://buy.stripe.com/def",
    STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PORTAL_URL: "https://billing.stripe.com/p/login/x",
    WHATSAPP_NUDGE_TEMPLATE: "reset_daily_reminder", WHATSAPP_TRIAL_TEMPLATE: "reset_trial_ending", WHATSAPP_BUSINESS_ACCOUNT_ID: "999",
  };
  const users = [
    { phone: "971500000001", ref: "sara", sub_status: "trial", lang: "ar", created_at: "2026-11-28T00:00:00Z", last_inbound_at: "2026-11-29T00:00:00Z", trial_ends_at: "2026-12-05T00:00:00Z" },
    { phone: "971500000002", ref: "sara", sub_status: "active", lang: "en", created_at: "2026-11-20T00:00:00Z", last_inbound_at: "2026-11-30T09:00:00Z" },
    { phone: "971500000003", sub_status: "trial", lang: "en", created_at: "2026-11-10T00:00:00Z", trial_ends_at: "2026-11-17T00:00:00Z" },
  ];
  const rest = async (path) => {
    if (path.startsWith("wa_users")) return users;
    if (path.startsWith("entries")) return [{ follow_up: "confirmed" }, { follow_up: "slipped" }, { follow_up: null }];
    return [];
  };
  const tpl = ["reset_daily_reminder", "reset_trial_ending"].flatMap((name) => ["en", "ar"].map((language) => ({ name, language, status: "APPROVED", category: "UTILITY" })));
  const fetchFn = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("message_templates") ? { data: tpl }
      : url.includes("subscribed_apps") ? { data: [{ id: "app" }] }
      : { display_phone_number: "+971 50 000 0009", verified_name: "Reset", quality_rating: "GREEN", name_status: "APPROVED" },
  });
  const r = await runStatus(env, { fetch: fetchFn, rest, now }, true);
  assert.equal(r.ready_for_real_users, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
  assert.equal(r.funnel.whatsapp_users, 3);
  assert.equal(r.funnel.in_trial, 1);
  assert.equal(r.funnel.trial_ended_unpaid, 1);
  assert.equal(r.funnel.paying, 1);
  assert.equal(r.funnel.mrr_aed_if_all_monthly, 29);
  assert.equal(r.funnel.moved_after_reset, 1);
  assert.equal(r.funnel.by_ref, "sara: 2 joined, 1 paying · (direct): 1 joined, 0 paying");
  const out = JSON.stringify(r) + renderHtml(r);
  for (const leak of ["ZZLEAK", "971500000001", "whsec_x"]) assert.ok(!out.includes(leak), `leaked ${leak}`);
});

test("status: catches the common setup mistakes", async () => {
  const now = new Date("2026-11-30T10:00:00Z");
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: "k", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", REACT_APP_WHATSAPP_NUMBER: "+971 50",
    PAY_LINK_MONTHLY: "https://buy.stripe.com/test_abc", STRIPE_WEBHOOK_SECRET: "sk_live_wrong",
  };
  const rest = async (path) => {
    if (path.startsWith("wa_users")) return [{ sub_status: "trial", created_at: now.toISOString(), followup_due_at: "2026-11-30T09:00:00Z" }];
    if (path.startsWith("wa_trial_used")) throw new Error("relation does not exist");
    return [];
  };
  const fetchFn = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Session has expired" } }) });
  const r = await runStatus(env, { fetch: fetchFn, rest, now }, true);
  const bad = (n) => r.checks.find((c) => c.name === n && !c.ok);
  assert.ok(bad("Stripe in live mode"));
  assert.ok(bad("Stripe webhook secret format"));
  assert.ok(bad("WhatsApp number format"));
  assert.ok(bad("Every-minute tick is running"));
  assert.ok(bad("Supabase table wa_trial_used"));
  assert.match(bad("Meta token + phone number").fix, /expired/);
});

test("paywall + trial-ending show what they'd keep (resets, moves kept); no line when 0 resets", async () => {
  process.env.PAY_LINK_MONTHLY = "https://buy.stripe.com/m";
  const db = memDb(), wa = recorder();
  const d = { db, wa };
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: t0 });
  for (const id of ["opt:Work", "opt:A message", "opt:Send it"]) await handleInbound(d, { phone: PHONE, msg: tap(id), now: t0 });
  const e = db.entries[0];
  await handleInbound(d, { phone: PHONE, msg: tap(`fu:confirmed:${e.id}`), now: t0 });
  // Trial-ending, inside the 24h window
  const dayBefore = new Date(t0.getTime() + 6.5 * 864e5);
  db.users.get(PHONE).last_inbound_at = new Date(dayBefore.getTime() - 3600e3).toISOString();
  db.users.get(PHONE).nudge_hour = null;
  let n = wa.sent.length;
  await tick(d, dayBefore);
  assert.ok(wa.sent[n].args[0].includes("1 reset, 1 move kept"), wa.sent[n].args[0]);
  // Paywall after the trial
  n = wa.sent.length;
  await handleInbound(d, { phone: PHONE, msg: text("hi"), now: new Date(t0.getTime() + 8 * 864e5) });
  assert.ok(wa.sent[n].args[0].includes("1 reset, 1 move kept"));
  // A user with no resets gets no recap line
  const db2 = memDb(), wa2 = recorder();
  await handleInbound({ db: db2, wa: wa2 }, { phone: PHONE, msg: text("hi"), now: t0 });
  db2.users.get(PHONE).state = "idle";
  n = wa2.sent.length;
  await handleInbound({ db: db2, wa: wa2 }, { phone: PHONE, msg: text("hi"), now: new Date(t0.getTime() + 8 * 864e5) });
  assert.ok(!wa2.sent[n].args[0].includes("free days:"));
  assert.ok(wa2.sent[n].args[0].includes("29 AED"));
});

test("STOP turns off reminders (Meta opt-out), in EN and AR; it is not treated as 'cancel subscription'", async () => {
  delete process.env.STRIPE_PORTAL_URL;
  for (const word of ["STOP", "Stop", "توقف"]) {
    const db = memDb(), wa = recorder();
    await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: t0 });
    const n = wa.sent.length;
    await handleInbound({ db, wa }, { phone: PHONE, msg: text(word), now: t0 });
    assert.equal(db.users.get(PHONE).nudge_hour, null);
    assert.equal(wa.sent.length, n + 1);
    assert.ok(!/cancel, reply with your email|للإلغاء، أرسل/.test(wa.sent[n].args[0]));
    // and the morning nudge no longer goes out
    const out = await tick({ db, wa }, new Date(t0.getTime() + 864e5));
    assert.equal(out.nudges, 0);
  }
});

// One full reset at `when` (Dubai = UTC+4), answering the 5-minute check with "Still done".
async function fullReset(deps, when) {
  const { db } = deps;
  for (const id of ["opt:Work", "opt:Starting", "opt:Open it"]) {
    // first message of a reset can be any text; then three taps
    if (id === "opt:Work") await handleInbound(deps, { phone: PHONE, msg: tap("start"), now: when });
    await handleInbound(deps, { phone: PHONE, msg: tap(id), now: when });
  }
  const u = db.users.get(PHONE);
  await handleInbound(deps, { phone: PHONE, msg: tap(`fu:confirmed:${u.followup_entry_id}`), now: new Date(when.getTime() + 6 * 6e4) });
}

test("smart moments: after 3 resets around 4 PM the reminder moves from 9 AM to 4 PM, once; fires at 4 PM", async () => {
  const db = memDb(), wa = recorder();
  const day = (n, utcH) => new Date(Date.UTC(2026, 10, 23 + n, utcH, 10));
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: day(0, 12) }); // 16:10 Dubai
  db.users.get(PHONE).nudge_chosen = false; // as after the migration (default false)
  db.users.get(PHONE).state = "idle";
  await fullReset({ db, wa }, day(0, 12));
  await fullReset({ db, wa }, day(1, 12));
  assert.equal(db.users.get(PHONE).nudge_hour, 9, "2 resets is not a habit yet");
  await fullReset({ db, wa }, day(2, 12));
  assert.equal(db.users.get(PHONE).nudge_hour, 16);
  const learnedMsgs = wa.sent.filter((m) => m.type === "text" && /usually reset around 4 PM/.test(m.args[0]));
  assert.equal(learnedMsgs.length, 1);
  await fullReset({ db, wa }, day(3, 12));
  assert.equal(wa.sent.filter((m) => m.type === "text" && /usually reset around/.test(m.args[0])).length, 1, "told only once");
  // next day: no reminder at 9 AM, one at 4 PM (template, they're outside 24h)
  process.env.WHATSAPP_NUDGE_TEMPLATE = "reset_daily_reminder";
  assert.equal((await tick({ db, wa }, new Date(Date.UTC(2026, 10, 28, 5, 0)))).nudges, 0);
  assert.equal((await tick({ db, wa }, new Date(Date.UTC(2026, 10, 28, 12, 0)))).nudges, 1);
  delete process.env.WHATSAPP_NUDGE_TEMPLATE;
});

test("smart moments: an hour the user picked is never overridden; 'time' / 'الوقت' opens the picker", async () => {
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: t0 });
  db.users.get(PHONE).nudge_chosen = false;
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("Time"), now: t0 });
  const picker = wa.sent[wa.sent.length - 1];
  assert.equal(picker.type, "list");
  assert.ok(picker.args[2].some((r) => r.id === "hr:19") && picker.args[2].some((r) => r.id === "hr:off"));
  assert.ok(picker.args[2].every((r) => r.title.length <= 24));
  await handleInbound({ db, wa }, { phone: PHONE, msg: tap("hr:19"), now: t0 });
  assert.equal(db.users.get(PHONE).nudge_hour, 19);
  assert.equal(db.users.get(PHONE).nudge_chosen, true);
  assert.ok(/7 PM/.test(wa.sent[wa.sent.length - 1].args[0]));
  db.users.get(PHONE).state = "idle";
  for (let n = 0; n < 3; n++) await fullReset({ db, wa }, new Date(t0.getTime() + n * 864e5 + 7 * 36e5));
  assert.equal(db.users.get(PHONE).nudge_hour, 19);
  // Arabic word + off
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("الوقت"), now: t0 });
  assert.equal(wa.sent[wa.sent.length - 1].type, "list");
  await handleInbound({ db, wa }, { phone: PHONE, msg: tap("hr:off"), now: t0 });
  assert.equal(db.users.get(PHONE).nudge_hour, null);
});

test("smart moments: before the migration (nudge_chosen missing) nothing moves; no nudge if they already came today", async () => {
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: t0 });
  db.users.get(PHONE).state = "idle";
  for (let n = 0; n < 3; n++) await fullReset({ db, wa }, new Date(t0.getTime() + n * 864e5 + 7 * 36e5));
  assert.equal(db.users.get(PHONE).nudge_hour, 9);
  // they messaged at 08:30 Dubai today -> the 9 AM nudge is skipped
  const day = new Date(Date.UTC(2026, 10, 28, 4, 30));
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("help"), now: day });
  process.env.WHATSAPP_NUDGE_TEMPLATE = "reset_daily_reminder";
  assert.equal((await tick({ db, wa }, new Date(Date.UTC(2026, 10, 28, 5, 0)))).nudges, 0);
  assert.equal((await tick({ db, wa }, new Date(Date.UTC(2026, 10, 29, 5, 0)))).nudges, 1);
  delete process.env.WHATSAPP_NUDGE_TEMPLATE;
});

test("usualHour needs a clear habit and Arabic hour labels read naturally", async () => {
  const { T } = require("../api/_lib/copy");
  const at = (utcH, d = 1) => ({ created_at: new Date(Date.UTC(2026, 10, d, utcH, 5)).toISOString() });
  assert.equal(usualHour([at(12), at(12)]), null);
  assert.equal(usualHour([at(1), at(5, 2), at(9, 3)]), null);
  assert.equal(usualHour([at(12), at(12, 2), at(3, 3)]), 16);
  assert.equal(T.ar.hour(16), "الساعة 4 عصرًا");
  assert.equal(T.ar.hour(8), "الساعة 8 صباحًا");
  assert.equal(T.en.hour(13), "1 PM");
  assert.ok(!/morning|صباح/.test(T.en.nudge + T.ar.nudge));
});

test("calm: 'calm' / 'هدوء' / Calm-first tap sends a calm picture + breathing + calm page link, then Reset now; nudge offers it", async () => {
  for (const [word, lang, page] of [["calm", "en", "/?calm"], ["هدوء", "ar", "/?calm&lang=ar"]]) {
    const db = memDb(), wa = recorder();
    await handleInbound({ db, wa }, { phone: PHONE, msg: text(lang === "ar" ? "مرحبا" : "hi"), now: t0 });
    const n = wa.sent.length;
    await handleInbound({ db, wa }, { phone: PHONE, msg: text(word), now: t0 });
    assert.equal(wa.sent[n].type, "image");
    assert.ok(/\/calm-[1-3]\.png$/.test(wa.sent[n].args[0]), wa.sent[n].args[0]);
    assert.ok(wa.sent[n].args[1].includes(page));
    assert.equal(wa.sent[n + 1].type, "buttons");
    assert.equal(wa.sent[n + 1].args[1][0].id, "start");
    assert.equal(db.entries.length, 0, "calm word is not saved as an answer");
  }
  // Tap from the nudge
  const db = memDb(), wa = recorder();
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("hi"), now: t0 });
  await handleInbound({ db, wa }, { phone: PHONE, msg: tap("calm"), now: t0 });
  assert.ok(wa.sent.some((m) => m.type === "image"));
  // No image sender / image fails -> words still go out as text
  const db2 = memDb(), wa2 = recorder();
  wa2.image = async () => { throw new Error("bad url"); };
  await handleInbound({ db: db2, wa: wa2 }, { phone: PHONE, msg: text("hi"), now: t0 });
  const m = wa2.sent.length;
  await handleInbound({ db: db2, wa: wa2 }, { phone: PHONE, msg: text("calm"), now: t0 });
  assert.equal(wa2.sent[m].type, "text");
  assert.ok(wa2.sent[m].args[0].includes("Breathe in"));
  // After the trial, calm is behind the paywall like the reset
  const before = wa.sent.length;
  await handleInbound({ db, wa }, { phone: PHONE, msg: text("calm"), now: new Date(t0.getTime() + 9 * 864e5) });
  assert.ok(wa.sent.slice(before).every((x) => x.type !== "image"));
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log("✓", name);
    } catch (e) {
      failed++;
      console.log("✗", name, "\n ", e.message);
    }
  }
  console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();

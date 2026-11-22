// WhatsApp flow tests with an in-memory database and a recording sender.
// Run: node tests/whatsapp.test.js   (no Meta, Stripe or Supabase needed)
const assert = require("assert");
const { Readable } = require("stream");
const crypto = require("crypto");
const { handleInbound, tick, applyStripeEvent, TRIAL_DAYS } = require("../api/_lib/flow");
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
  return { sent, text: push("text"), list: push("list"), buttons: push("buttons"), template: push("template") };
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

// Minimal Supabase REST client for server functions (service role key: server only).
const BASE = () => (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: KEY(),
    Authorization: `Bearer ${KEY()}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${BASE()}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;

// The real data layer. Tests swap this for an in-memory one with the same methods.
const db = {
  async getUser(phone) {
    const rows = await rest(`wa_users?phone=eq.${enc(phone)}&select=*`);
    return rows[0] || null;
  },
  async getUserByProfile(profileId) {
    const rows = await rest(`wa_users?profile_id=eq.${enc(profileId)}&select=*`);
    return rows[0] || null;
  },
  async getUserBySubscription(subId) {
    const rows = await rest(`wa_users?stripe_subscription_id=eq.${enc(subId)}&select=*`);
    return rows[0] || null;
  },
  async createUser(user) {
    const rows = await rest("wa_users", { method: "POST", body: user, prefer: "return=representation" });
    return rows[0];
  },
  async updateUser(phone, patch) {
    const rows = await rest(`wa_users?phone=eq.${enc(phone)}`, {
      method: "PATCH",
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    });
    return rows[0];
  },
  async ensureProfile(id, name) {
    await rest("profiles?on_conflict=id", {
      method: "POST",
      body: { id, name: name || "WhatsApp user" },
      prefer: "resolution=ignore-duplicates",
    });
  },
  async insertEntry(entry) {
    const rows = await rest("entries", { method: "POST", body: entry, prefer: "return=representation" });
    return rows[0];
  },
  async updateEntry(id, patch) {
    await rest(`entries?id=eq.${enc(id)}`, { method: "PATCH", body: patch });
  },
  async pastAnswers(profileId) {
    return rest(`entries?profile_id=eq.${enc(profileId)}&select=mind,avoiding,move,follow_up&order=created_at.desc&limit=50`);
  },
  async dueFollowups(nowIso) {
    return rest(`wa_users?followup_due_at=lte.${enc(nowIso)}&select=*`);
  },
  async allUsers() {
    return rest("wa_users?select=*");
  },
};

module.exports = { db, rest };

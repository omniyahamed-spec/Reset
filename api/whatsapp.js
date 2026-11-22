// WhatsApp Cloud API webhook.
// GET  -> Meta's one-time verification (hub.challenge).
// POST -> incoming messages; each one runs the Reset conversation.
const { db } = require("./_lib/db");
const { wa } = require("./_lib/wa");
const { handleInbound } = require("./_lib/flow");
const { rawBody, metaSignatureOk } = require("./_lib/http");

/** Meta message -> { kind, text, id } */
function normalize(m) {
  if (m.type === "text") return { kind: "text", text: m.text && m.text.body };
  if (m.type === "interactive") {
    const r = m.interactive.button_reply || m.interactive.list_reply || {};
    return { kind: "reply", id: r.id, text: r.title };
  }
  if (m.type === "button") return { kind: "reply", id: m.button && m.button.payload, text: m.button && m.button.text };
  if (m.type === "audio") return { kind: "voice" };
  return { kind: "other", text: "" };
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const q = req.query || {};
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(q["hub.challenge"]);
    } else {
      res.status(403).send("Forbidden");
    }
    return;
  }
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const raw = await rawBody(req);
  if (!metaSignatureOk(raw, req.headers["x-hub-signature-256"], process.env.WHATSAPP_APP_SECRET)) {
    return res.status(401).send("Bad signature");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return res.status(400).send("Bad JSON");
  }

  const jobs = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile && c.profile.name]));
      for (const m of v.messages || []) {
        jobs.push(
          handleInbound({ db, wa }, { phone: m.from, name: names[m.from], msg: normalize(m) }).catch((e) =>
            console.error("handleInbound failed", m.from, e.message)
          )
        );
      }
    }
  }
  await Promise.all(jobs);
  // Always 200 so Meta doesn't retry the same message in a loop.
  res.status(200).send("ok");
};

module.exports.normalize = normalize;

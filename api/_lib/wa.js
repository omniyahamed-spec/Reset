// WhatsApp Cloud API sender (Meta Graph API).
const VERSION = process.env.WHATSAPP_API_VERSION || "v25.0"; // v21.0 is removed on 21 Jan 2027

async function send(to, payload) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  if (!res.ok) throw new Error(`WhatsApp send ${res.status}: ${await res.text()}`);
  return res.json();
}

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Same interface the flow uses; tests swap in a recorder.
const wa = {
  text: (to, body) => send(to, { type: "text", text: { body, preview_url: true } }),

  // rows: [{ id, title }] — up to 10.
  list: (to, body, button, rows) =>
    send(to, {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: body },
        action: {
          button: cut(button, 20),
          sections: [{ title: cut(button, 24), rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: cut(r.title, 24) })) }],
        },
      },
    }),

  // buttons: [{ id, title }] — up to 3.
  buttons: (to, body, buttons) =>
    send(to, {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: cut(b.title, 20) } })) },
      },
    }),

  // Pre-approved template, the only way to message someone 24h+ after their last message.
  template: (to, name, lang) =>
    send(to, { type: "template", template: { name, language: { code: lang === "ar" ? "ar" : "en" } } }),
};

module.exports = { wa };

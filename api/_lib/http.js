const crypto = require("crypto");

/** Raw request body (needed to check Meta's and Stripe's signatures). */
// Read the stream first, before touching req.body: on Vercel, req.body is a lazy getter
// that parses JSON, and a re-serialized object no longer matches the signature.
async function rawBody(req) {
  if (req && typeof req[Symbol.asyncIterator] === "function" && !req.readableEnded) {
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  }
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  return "";
}

const safeEqual = (a, b) => {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Meta: X-Hub-Signature-256 = "sha256=" + HMAC(app secret, raw body). */
function metaSignatureOk(raw, header, secret) {
  if (!secret) return true; // not configured yet: accept (set WHATSAPP_APP_SECRET in production)
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  return safeEqual(expected, header);
}

/** Stripe: Stripe-Signature "t=...,v1=..."; signed payload is `${t}.${raw}`. 5-minute tolerance. */
function stripeSignatureOk(raw, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    })
  );
  const v1s = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!parts.t || !v1s.length || Math.abs(nowSec - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`, "utf8").digest("hex");
  return v1s.some((v) => safeEqual(expected, v));
}

module.exports = { rawBody, metaSignatureOk, stripeSignatureOk };

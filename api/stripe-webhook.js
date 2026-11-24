// Stripe webhook: payment done -> unlock the WhatsApp number; subscription ended -> lock it.
// Events to send from Stripe: checkout.session.completed,
// customer.subscription.updated, customer.subscription.deleted.
const { db } = require("./_lib/db");
const { wa } = require("./_lib/wa");
const { applyStripeEvent } = require("./_lib/flow");
const { rawBody, stripeSignatureOk } = require("./_lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const raw = await rawBody(req);
  if (!stripeSignatureOk(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).send("Bad signature");
  }
  try {
    const result = await applyStripeEvent({ db, wa }, JSON.parse(raw));
    res.status(200).json({ result });
  } catch (e) {
    console.error("stripe webhook failed", e.message);
    res.status(500).send("error"); // Stripe retries
  }
};

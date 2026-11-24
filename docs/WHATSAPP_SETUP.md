# Reset on WhatsApp — setup

The code is on main (PR #11, merged 24 Nov). These steps connect your accounts. Do them in order.
After each step, open the status page (step 6) — it tells you what's done and the exact next fix.
Until step 4 is done, the site shows "Opening soon" instead of the WhatsApp button.

Tests (no accounts needed): `node tests/whatsapp.test.js`

## 1. Supabase (2 minutes)
SQL Editor → run `supabase/migrations/20261122_whatsapp.sql`.

Then run this (replace CRON_SECRET_HERE with the same value you put in Vercel, step 4):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'reset-whatsapp-tick',
  '* * * * *',
  $$ select net.http_get(url := 'https://reset-cjii.vercel.app/api/tick?key=CRON_SECRET_HERE') $$
);
```

## 2. Meta (WhatsApp)
developers.facebook.com → your app → WhatsApp → API Setup:
- Copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- Copy the **access token** → `WHATSAPP_TOKEN` (the temporary one lasts 24h; for real use create a System User token in Business Settings)
- Add your own number under "To" so the test number can message you.

App settings → Basic → **App secret** → `WHATSAPP_APP_SECRET`
App settings → Basic → **Privacy Policy URL**: `https://reset-cjii.vercel.app/?privacy`, **Terms of Service URL**: `https://reset-cjii.vercel.app/?terms` (Meta requires these before the app can go Live).

WhatsApp → Configuration → Webhook:
- Callback URL: `https://reset-cjii.vercel.app/api/whatsapp`
- Verify token: any phrase you choose → same phrase in `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field.

(Do this after step 4, so the verify call finds the token.)

## 3. Stripe
- Product "Reset" with two prices: 29 AED / month, 249 AED / year.
- Payment Links → one per price → `PAY_LINK_MONTHLY`, `PAY_LINK_YEARLY`. After payment: "Show confirmation page" → "You're in. Go back to WhatsApp."
- Settings → Billing → Customer portal → activate → copy the login link → `STRIPE_PORTAL_URL`
- Developers → Webhooks → add endpoint `https://reset-cjii.vercel.app/api/stripe-webhook`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → signing secret → `STRIPE_WEBHOOK_SECRET`

## 4. Vercel
Project reset-cjii → Settings → Environment Variables (Production), then Redeploy:

| Name | Where from |
|---|---|
| WHATSAPP_TOKEN | Meta, step 2 |
| WHATSAPP_PHONE_NUMBER_ID | Meta, step 2 |
| WHATSAPP_VERIFY_TOKEN | your phrase |
| WHATSAPP_APP_SECRET | Meta, step 2 |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API → service_role (secret) |
| PAY_LINK_MONTHLY / PAY_LINK_YEARLY | Stripe, step 3 |
| STRIPE_PORTAL_URL | Stripe, step 3 |
| STRIPE_WEBHOOK_SECRET | Stripe, step 3 |
| CRON_SECRET | a long random string (same as in the step 1 SQL) |
| REACT_APP_WHATSAPP_NUMBER | the WhatsApp number, digits only, e.g. 9715XXXXXXXX |
| REACT_APP_CONTACT_EMAIL | optional: email shown on the Privacy and Terms pages |
| WHATSAPP_BUSINESS_ACCOUNT_ID | optional: Meta → WhatsApp → API Setup → WhatsApp Business Account ID; lets the status page check templates and the webhook subscription |

After Meta approves the two message templates (exact text in docs/WHATSAPP_TEMPLATES.md — submit them on day 1, approval can take hours to days):
`WHATSAPP_NUDGE_TEMPLATE=reset_daily_reminder`, `WHATSAPP_TRIAL_TEMPLATE=reset_trial_ending`.
Without them Reset still works; it just can't reach people who've been quiet for 24h+.

## 5. Test
Send "hi" to the number from your phone. You should get the welcome and the first question.

## 6. Check everything in one place
Open `https://reset-cjii.vercel.app/api/status?key=CRON_SECRET_HERE` (your CRON_SECRET).
- Green/red list of every step, with the exact fix for anything red, and "Next:" at the top.
- Catches the usual mistakes: expired 24h Meta token, test-mode Stripe links, `sk_…` pasted instead of `whsec_…`, landing number ≠ Meta number, Meta's test number (max 5 recipients), pg_cron not running, missing tables, templates not approved or re-categorised Marketing.
- Below it: the WhatsApp funnel (users, joined/active last 7 days, in trial, trial ended unpaid, paying, resets and "still done" in the last 7 days). Paste it (or `&format=json`) to the co-founder run so decisions use real numbers.
- Before CRON_SECRET is set, it only lists missing settings. It never shows secrets or phone numbers.

## Landing page links (for outreach)
- English: `https://reset-cjii.vercel.app/` · Arabic: `https://reset-cjii.vercel.app/?lang=ar` (Arabic phones get Arabic automatically).
- The Arabic page opens WhatsApp with "ابدأ Reset", so the bot answers in Arabic from the first message.
- Printable QR poster: `/?qr` (English) or `/?qr&lang=ar` — print or screenshot for events and flyers.
- Link previews (WhatsApp, LinkedIn) use `public/og.png` and the title in `public/index.html`.
- Google Analytics events: `start_whatsapp` (lang, top/bottom button), `share_click`, `switch_lang`. GA → Reports → Engagement → Events.

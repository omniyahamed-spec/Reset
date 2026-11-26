# Reset — handover glossary (for another AI or developer)

Written 26 Nov 2026. Owner: Omnia. Repo: `omniyahamed-spec/Reset` (also reachable as `reset`). Deploys: Vercel projects reset-cjii (main one), reset-tcbe, reset-7nhg, reset — all build the same repo.

## 1. What Reset is (one paragraph)
Reset helps people act on what they avoid by taking the smallest possible step. Core loop ("3-tap reset"): tap what's in your head → tap what you're avoiding → tap the smallest move → do it in 2 minutes → Reset asks 5 minutes later "still done?" Positioning: "So many apps for distraction — this one is for action." It is NOT a meditation or mental-health app and must not claim to treat anything.

## 2. Current business model (decided 22 Nov 2026, Omnia's decision)
- WhatsApp-first, B2C only. Individuals pay **29 AED/month or 249 AED/year** after a **7-day free trial**, via Stripe Payment Links.
- The website root is the landing + pricing page. The old web app is at `?app`.
- B2B (teams, sponsor codes, invoices) is hidden but the code is kept (`?app&teams`).
- Revenue goal: at least **30,000 AED/month recurring** (about 1,035 monthly subscribers at 29 AED).
- Validation cohort of real users was **0** as of 25 Nov. The setup (Meta number, Stripe links, Vercel env, pg_cron) was not confirmed done.

## 3. Hard rules (do not break)
1. Never push to `main`. Work on a branch, open a PR via the GitHub API/MCP. Omnia merges.
2. Never make irreversible decisions (pricing, deleting features, merging to production, contacting people, spending money). Put them to Omnia as a decision.
3. Meta rules: general-purpose AI chatbots are banned on the WhatsApp Business Platform (since 15 Jan 2026). Reset must stay a structured single-purpose flow. Messages outside the 24h window need approved templates; keep them Utility-style. WhatsApp terms forbid selling/sharing Business Solution Data.
4. Arabic everywhere = **formal Arabic (فصحى)**, not Gulf dialect. Style, not translation of everything.
5. Before pushing: `npm install`; `CI=true REACT_APP_SUPABASE_URL=https://x.supabase.co REACT_APP_SUPABASE_ANON_KEY=x npx react-scripts build` must pass; `node tests/whatsapp.test.js` must pass (17 tests). Look at changed pages in headless Chrome.
6. Schema changes go in `supabase/migrations/` with exact paste instructions for Omnia.
7. No new features that don't serve getting the first 10–20 real WhatsApp users and the first payment.

## 4. Glossary of terms
- **Reset / 3-tap reset** — the core flow: mind → avoiding → move. Answers are saved as an `entries` row.
- **Follow-up ("Still done / It slipped")** — the 5-minute check after a reset. Saved to `entries.follow_up` (`confirmed` or `slipped`) and `follow_up_at`. This is the product's only outcome metric ("moved after reset").
- **Learned chips** — after 2+ uses, the user's own repeated answers appear as options (max 2).
- **Check-in / check-out** — the daily loop in the web app: morning "one thing + first 2-minute move", evening "yes/partly/no + blocker + tomorrow's thing". Table `daily_checkins`.
- **Source** — `entries.source`: `organic | reminder | notification | whatsapp`. Used for the "unprompted resets" metric.
- **Profile** — anonymous user row (`profiles`); WhatsApp users get `wa_` + hash of their number.
- **wa_users** — one row per WhatsApp number: language, state, draft, trial/subscription, follow-up due time, nudge hour, `ref`.
- **State machine** — `idle | ask_mind | ask_avoid | ask_move` in `wa_users.state`.
- **Trial / paywall** — 7 days from first message; afterwards the bot sends the two Stripe links at most once an hour. `sub_status`: `trial | active | canceled`.
- **client_reference_id** — the user's `profile_id` appended to Stripe links so the webhook can match a payment to a user.
- **wa_trial_used** — hashes of numbers that already had a trial, so "delete my data" then re-joining doesn't give a second trial.
- **Nudge** — the 9am (Dubai) daily reminder. Opt-in disclosed in the welcome; "no reminders" turns it off. Inside 24h it is a plain message; outside it must be a template.
- **Templates** — `reset_daily_reminder` and `reset_trial_ending` (Utility, EN + AR), texts in `docs/WHATSAPP_TEMPLATES.md`. Quick-reply payloads: `start`, `plans`.
- **24h window** — WhatsApp only allows free-form messages within 24h of the user's last message.
- **tick** — `api/tick.js`, called every minute by Supabase pg_cron; sends due follow-ups, nudges, trial reminders.
- **Status page** — `/api/status?key=CRON_SECRET`: green/red go-live checklist with exact fixes plus the WhatsApp funnel. Never shows secrets or phone numbers.
- **ref** — `?ref=<name>` on landing links → first WhatsApp message `Reset [name]` → saved on `wa_users.ref` → funnel by ref on the status page.
- **Prefill** — the text the "Start on WhatsApp" button puts in the first message ("Reset" / "ابدأ Reset"). Arabic letters make the bot answer in Arabic. Must match `FIRST_MSG` in `src/Landing.tsx` and the tests.
- **Poster** — `/?qr` printable QR page (EN/AR), keeps `ref`.
- **Auto-update** — build id in the bundle and `/version.json`; the app reloads itself when a newer build exists.
- **Scorecard** — `/api/validation` (PR #7, still open): token-protected go/iterate/stop view of the 10-user validation bars.

## 5. Map of the code
| Path | What it does |
|---|---|
| `api/whatsapp.js` | Meta webhook (verify + inbound). Reads the raw body first for signature checking. |
| `api/_lib/flow.js` | All conversation logic as pure functions (`handleInbound`, `tick`, `applyStripeEvent`). I/O injected, so it is testable. |
| `api/_lib/copy.js` | Every bot message in EN + formal AR, option lists, command words. |
| `api/_lib/wa.js` | Graph API sender (text, list, buttons, template). Default API version v25.0. |
| `api/_lib/db.js` | Supabase REST client (service role key, server only). |
| `api/_lib/http.js` | Raw-body reader, Meta and Stripe signature checks. |
| `api/_lib/status.js`, `api/status.js` | Go-live checklist + funnel. |
| `api/stripe-webhook.js` | Checkout completed → active; subscription deleted → canceled. |
| `api/tick.js` | Every-minute scheduler endpoint (needs `CRON_SECRET`). |
| `api/calendar.js` | `.ics` files for daily reminder events (web app). |
| `src/Landing.tsx` | Public landing + pricing, EN/AR, share button, QR, poster, GA events. |
| `src/Legal.tsx` | `?privacy` and `?terms` (Meta needs a privacy URL to go live). |
| `src/App.tsx` | Web app (large single file). Root shows Landing unless `?app`, `?src`, `?do` or `?screen`. |
| `src/TapStep.tsx`, `src/DailyLoop.tsx`, `src/daily.ts` | 3-tap reset UI; daily loop UI and logic. |
| `tests/whatsapp.test.js` | 17 tests with an in-memory DB and a recording sender. No accounts needed. |
| `docs/WHATSAPP_SETUP.md` | Step-by-step go-live (Supabase, Meta, Stripe, Vercel, test, status). |
| `docs/WHATSAPP_TEMPLATES.md` | Submit-ready Meta template text. |

## 6. Environment variables (Vercel)
Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` (optional), `WHATSAPP_NUDGE_TEMPLATE`, `WHATSAPP_TRIAL_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG_EN` (optional), `WHATSAPP_BUSINESS_ACCOUNT_ID` (optional, lets the status page check templates), `PAY_LINK_MONTHLY`, `PAY_LINK_YEARLY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_URL`.
Build-time (public): `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_WHATSAPP_NUMBER` (landing shows "Opening soon" until set), `REACT_APP_CONTACT_EMAIL`, `REACT_APP_PILOT_PAYMENT_LINK`, `REACT_APP_PRO_PAYMENT_LINK` (B2B, hidden).

## 7. Migrations (supabase/migrations, run in order, all safe to re-run)
1. `20261120_entries_follow_up.sql` — follow_up columns on entries.
2. `20261120_revenue.sql` — B2B revenue/sponsor model (hidden).
3. `20261121_entries_source.sql` — `entries.source`.
4. `20261122_daily_checkins.sql` — check-in/out table.
5. `20261122_whatsapp.sql` — `wa_users`, `wa_trial_used`, subscribers view, RLS on.
6. `20261125_wa_ref.sql` — `wa_users.ref`.
Queries: `supabase/queries/validation_metrics.sql`, `monthly_invoice.sql`.

## 8. Change history (newest last)
| PR | State | What |
|---|---|---|
| #1 | merged | Persist the 5-minute follow-up answer; pending follow-up survives closing the app (12h expiry). |
| #2, #4, #5 | merged (other sessions, 20 Nov) | Profile IDs; revenue model and sponsor codes (B2B, now hidden); calm redesign. |
| #6 | merged with #8 | "Same time tomorrow?" calendar reminder, `source` tagging. |
| #7 | **open** | `/api/validation` scorecard. Needs `SUPABASE_SERVICE_ROLE_KEY` and `VALIDATION_TOKEN`. |
| #8 | merged | Daily check-in / 2-minute sprint / check-out loop. |
| #9 | merged | Auto-update (build id, banner/reload). |
| #10 | merged | Concept v1: 3-tap reset, no AI reflection, Start Reset always on home, calmer home. |
| #11 | merged 24 Nov | WhatsApp-first B2C: flow, Stripe, landing + pricing, legal pages, delete-my-data, templates, Arabic landing, QR, share. |
| #12 | **open** | Formal Arabic (missed #11 by hours), `/api/status` go-live page + funnel, `?ref` attribution. **Production still has Gulf dialect until this merges.** |

## 9. Open items, in priority order
1. Omnia: run `20261125_wa_ref.sql`, merge #12, finish `docs/WHATSAPP_SETUP.md` until `/api/status` is green, test on a phone, submit the 2 templates.
2. Send the first 20 recruiting messages, one `?ref=` link per person.
3. Pre-commit validation bars (proposed): day-1 first reset 70%+, day-7 active 40%+, day-8 payment 15%+ of starters (3 of 20), day-37 renewal 60%+ of payers.
4. Self-test: Omnia uses the bot 7 days herself.
5. Decisions for Omnia: trial length (7 vs 14 days), card up front or not, annual plan emphasis, which first segment (UAE freelancers / professionals / students).
6. Ideas not built: weekly pattern mirror ("your top avoided category and what worked"), friend referral/accountability buddy, every-2-days reminder if the daily one gets re-categorised as Marketing, privacy fix for anon RLS on web `entries`.
7. Known issue: web app RLS allows anonymous select on `entries`/`daily_checkins` (fix needs anonymous sign-ins in Supabase) — fix before any public push of the web app.

## 10. Research conclusions (Nov 2026)
- Meditation/mental-health apps are shrinking (Calm/Headspace downloads down 61%/74% since 2018). Reset should stay positioned on action/outcome, not mood.
- RevenueCat 2026: annual plans retain far better than monthly (year-1 retention 20–40% vs 6–14%); most trial cancellations happen on day 0–1; the first minute has to deliver value.
- Duolingo-style winners are daily habits driven by word of mouth. Reset is episodic ("when stuck"), so the daily check-in is the retention anchor.
- Code is easy to copy. Defensibility = outcome data, daily habit in the WhatsApp thread, formal Arabic and regional trust, and speed.

## 11. How the co-founder routine works
A scheduled task ("Reset co-founder — daily") runs ~10:30 Dubai: reads memory `/areas/reset-app.md` and `/areas/reset-cofounder-log.md`, picks one improvement, commits to the open PR branch, appends a dated Done/Why/Next entry to the log, sends Omnia a short summary (Done / blunt Feedback / one Decision). Any AI taking over should do the same: read the log first, do not repeat work, no irreversible decisions.

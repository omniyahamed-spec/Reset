# WhatsApp message templates — submit these to Meta

Reset only needs templates for messages sent **more than 24 hours after the user's last message**.
Everything else (the 3-tap reset, the 5-minute check, plans, paywall) is free-form inside the 24h window.

Two templates. Both are written to qualify as **Utility** (tied to something the user set up:
their daily reminder, their trial). No offers, no prices, no links, no "don't miss", no emojis —
those push Meta to re-categorise a template as Marketing (about 3x the price in the UAE).

Where: Meta Business Suite → WhatsApp Manager → Message templates → Create template.
Create each template **twice under the same name**: once in English (`en`), once in Arabic (`ar`).
The code picks the language from the user's setting.

---

## 1. `reset_daily_reminder`

- Category: **Utility**
- Type: Default (text), with one **Quick reply** button
- Variables: none
- Vercel env var after approval: `WHATSAPP_NUDGE_TEMPLATE=reset_daily_reminder`

**English (en)**

Body:
```
Your daily Reset reminder. When you're ready, tap below to take today's first small step.
```
Footer:
```
Reply "no reminders" to turn this off
```
Quick reply button: `Reset now`

**Arabic (ar)**

Body:
```
هذا تذكيرك اليومي من Reset. عندما تكون مستعدًا، اضغط على الزر أدناه لتبدأ أول خطوة صغيرة اليوم.
```
Footer:
```
أرسل "إيقاف التذكير" لإيقاف هذه الرسالة
```
Quick reply button: `ابدأ الآن`

How it works in code: sent at 09:00 Dubai only to users who have access and haven't written in 24h.
The button's payload is set to `start` at send time, so a tap opens the first question.

---

## 2. `reset_trial_ending`

- Category: **Utility**
- Type: Default (text), with one **Quick reply** button
- Variables: `{{1}}` = trial end date. Sample for review: `27 Nov` (Arabic sample: `27 نوفمبر`)
- Vercel env var after approval: `WHATSAPP_TRIAL_TEMPLATE=reset_trial_ending`

**English (en)**

Body:
```
Your Reset free trial ends on {{1}}. Tap below to see your plan options. Nothing is charged unless you choose a plan.
```
Quick reply button: `See plans`

**Arabic (ar)**

Body:
```
تنتهي تجربتك المجانية في Reset بتاريخ {{1}}. اضغط على الزر أدناه للاطلاع على خيارات الاشتراك. لن تُخصم منك أي رسوم ما لم تختر اشتراكًا.
```
Quick reply button: `عرض الخيارات`

How it works in code: sent once, in the last 24h of the trial, only if the user hasn't written in 24h
(otherwise a normal message with the link goes instead). The button payload is `plans`; the tap opens
a free 24h window and Reset replies with the monthly and yearly Stripe links. Links are kept out of the
template on purpose — a payment link in a template is the fastest way to get re-categorised as Marketing.

---

## If Meta re-categorises one as Marketing

It can happen, especially to the daily reminder (Meta reads "daily nudge" as engagement).
- It still works; it just costs ~AED 0.18 instead of ~0.06 per message.
- Worst case cost: 30 reminders/month × 0.18 = ~AED 5.5 per user/month out of 29 — and only for users
  who have gone quiet for 24h+. Users who reset every day never trigger a template.
- Marketing templates also need the user to have opted in; the welcome message now says
  "one short reminder a day, at 9 AM at first, then at the hour you usually get stuck — reply 'time' to choose, 'no reminders' to turn it off", which covers that. The template text is time-neutral, so it fits any hour.
- Do not appeal by adding fake transactional wording. If it stays Marketing, decide whether quiet users
  should get a reminder every day or only every 2–3 days (Omnia's call; it's a one-line change).

## Not needed yet
- Authentication templates (no logins over WhatsApp).
- A payment-confirmed template: Stripe redirects to "Go back to WhatsApp", and the user's next message
  is inside the window.

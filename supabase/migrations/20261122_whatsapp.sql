-- Reset on WhatsApp (B2C). Run once in Supabase > SQL Editor.
-- One row per WhatsApp number: where they are in the reset, trial and subscription.
create table if not exists public.wa_users (
  phone                  text primary key,          -- WhatsApp number, digits only (e.g. 9715XXXXXXXX)
  profile_id             text not null unique,      -- 'wa_' + hash; links to profiles/entries
  name                   text,
  lang                   text not null default 'en' check (lang in ('en', 'ar')),
  state                  text not null default 'idle',  -- idle | ask_mind | ask_avoid | ask_move
  draft                  jsonb not null default '{}'::jsonb,
  sub_status             text not null default 'trial' check (sub_status in ('trial', 'active', 'canceled')),
  trial_ends_at          timestamptz,
  trial_reminded         boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  paywall_sent_at        timestamptz,
  followup_due_at        timestamptz,
  followup_entry_id      text,
  last_inbound_at        timestamptz,
  nudge_hour             smallint default 9 check (nudge_hour between 0 and 23),  -- Dubai time; null = off
  last_nudge_on          date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists wa_users_followup_due on public.wa_users (followup_due_at) where followup_due_at is not null;
create index if not exists wa_users_sub on public.wa_users (stripe_subscription_id);

-- Only the server (service role key) touches this table. RLS on, no policies = no anon access.
alter table public.wa_users enable row level security;

-- Paying users per month, for the revenue view.
create or replace view public.wa_subscribers as
select sub_status, lang, count(*) as users
from public.wa_users group by sub_status, lang;

-- Resets done in WhatsApp are saved in `entries` like app resets, tagged source = 'whatsapp'.
alter table public.entries add column if not exists source text;
alter table public.entries drop constraint if exists entries_source_check;
alter table public.entries
  add constraint entries_source_check check (source in ('organic', 'reminder', 'notification', 'whatsapp'));

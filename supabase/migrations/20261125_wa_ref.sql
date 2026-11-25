-- Referral attribution for outreach links (?ref=<name> on the landing page).
-- Run once in Supabase > SQL Editor. Safe to re-run.
alter table public.wa_users add column if not exists ref text;
create index if not exists wa_users_ref on public.wa_users (ref) where ref is not null;

-- Smart moments: the daily reminder moves to the hour each user usually resets at,
-- unless they picked an hour themselves (reply "time" / "الوقت").
-- Run once in Supabase > SQL Editor. Safe to re-run.
alter table public.wa_users add column if not exists nudge_chosen boolean not null default false;

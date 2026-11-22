-- Daily loop: morning check-in, 2-minute sprint, evening check-out.
-- One row per person per day. Run once in Supabase > SQL Editor.
-- The app also keeps a copy on the device, so nothing breaks before this runs.
create table if not exists public.daily_checkins (
  profile_id  text        not null,
  day         date        not null,              -- the user's local date
  one_thing   text,
  first_move  text,
  energy      smallint check (energy between 1 and 5),   -- presence score at check-in
  checkin_at  timestamptz,
  sprint_done boolean     not null default false,
  outcome     text check (outcome in ('yes', 'partly', 'no')),
  blocker     text,
  checkout_at timestamptz,
  tomorrow    text,
  source      text,                               -- organic | reminder | notification
  updated_at  timestamptz not null default now(),
  primary key (profile_id, day)
);

-- Same access model as `entries`: the app talks to Supabase with the anon key
-- and scopes every query by its private random profile_id.
alter table public.daily_checkins enable row level security;

drop policy if exists "daily_checkins anon read" on public.daily_checkins;
create policy "daily_checkins anon read" on public.daily_checkins
  for select to anon, authenticated using (true);

drop policy if exists "daily_checkins anon insert" on public.daily_checkins;
create policy "daily_checkins anon insert" on public.daily_checkins
  for insert to anon, authenticated with check (true);

drop policy if exists "daily_checkins anon update" on public.daily_checkins;
create policy "daily_checkins anon update" on public.daily_checkins
  for update to anon, authenticated using (true) with check (true);

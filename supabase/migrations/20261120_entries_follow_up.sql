-- Stores the 5-minute "Still done / It slipped" answer on each reset entry.
alter table public.entries
  add column if not exists follow_up text
    check (follow_up in ('confirmed', 'slipped')),
  add column if not exists follow_up_at timestamptz;

-- The app updates follow_up via the anon key. If RLS is on and there is no
-- update policy for entries yet, the existing feedback update would already be
-- failing too; check Authentication > Policies for an UPDATE policy on entries.

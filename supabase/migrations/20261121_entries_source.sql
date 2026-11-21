-- Tags each reset with where it came from, so validation bar 2
-- ("3+ unprompted resets") is measurable.
--   organic      = user opened Reset on their own
--   reminder     = opened from the daily calendar reminder link (?src=reminder)
--   notification = within 30 min of the in-app nudge
-- Rows saved before this migration stay null (unknown).
alter table public.entries
  add column if not exists source text
    check (source in ('organic', 'reminder', 'notification'));

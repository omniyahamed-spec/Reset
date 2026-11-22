-- 10-user validation metrics, per user (profile).
-- Bar 1: moved-after-reset >= 60%  -> moved_rate
-- Bar 2: >= 5/10 users with 3+ unprompted resets -> unprompted_resets >= 3
--        (source = 'organic'; rows before 2026-11-21 have source null = unknown)
select
  e.profile_id,
  count(*)                                                   as total_resets,
  count(*) filter (where e.source = 'organic')               as unprompted_resets,
  count(*) filter (where e.source in ('reminder','notification')) as prompted_resets,
  count(*) filter (where e.status = 'done')                  as said_done,
  count(*) filter (where e.follow_up = 'confirmed')          as still_done_5min,
  count(*) filter (where e.follow_up = 'slipped')            as slipped_5min,
  round(100.0 * count(*) filter (where e.follow_up = 'confirmed')
        / nullif(count(*), 0), 1)                            as moved_rate_pct,
  min(e.created_at)                                          as first_reset,
  max(e.created_at)                                          as last_reset
from public.entries e
group by e.profile_id
order by total_resets desc;

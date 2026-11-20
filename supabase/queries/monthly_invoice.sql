-- Monthly invoice per sponsor. A "verified move" = a reset whose move the person
-- confirmed was still done at the 5-minute follow-up (entries.follow_up = 'confirmed').
-- Change the month on the next line to bill a different month.
with params as (select date '2026-12-01' as month_start),
per_person as (
  select p.org_code,
         e.profile_id,
         count(*) filter (where e.follow_up = 'confirmed') as verified_moves,
         count(*)                                          as resets
  from public.entries e
  join public.profiles p on p.id = e.profile_id
  cross join params
  where p.org_code is not null
    and e.created_at >= params.month_start
    and e.created_at <  params.month_start + interval '1 month'
  group by p.org_code, e.profile_id
),
billed as (
  select pp.*,
         case when o.person_cap_aed is null then pp.verified_moves * o.per_move_aed
              else least(pp.verified_moves * o.per_move_aed, o.person_cap_aed) end as person_fee
  from per_person pp join public.orgs o on o.code = pp.org_code
)
select o.code,
       o.name,
       o.plan,
       count(b.profile_id)                         as people_active,
       coalesce(sum(b.resets), 0)                  as resets,
       coalesce(sum(b.verified_moves), 0)          as verified_moves,
       o.base_fee_aed,
       coalesce(sum(b.person_fee), 0)              as outcome_fee_aed,
       o.base_fee_aed + coalesce(sum(b.person_fee), 0) as invoice_total_aed
from public.orgs o
left join billed b on b.org_code = o.code
where o.active
group by o.code, o.name, o.plan, o.base_fee_aed
order by invoice_total_aed desc;

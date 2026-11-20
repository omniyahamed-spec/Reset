-- Revenue model: sponsor codes (company / coach), verified-move billing, lead capture.
-- Run once in Supabase > SQL Editor.

-- 1) Sponsors: companies and coaches who pay for their people.
create table if not exists public.orgs (
  code          text primary key,                 -- what people type, e.g. ACME
  name          text not null,
  kind          text not null default 'company'
                  check (kind in ('company', 'coach', 'partner')),
  plan          text not null default 'teams'
                  check (plan in ('pilot', 'teams', 'coach')),
  base_fee_aed  numeric not null default 0,       -- monthly platform fee
  per_move_aed  numeric not null default 0,       -- price per verified move
  person_cap_aed numeric,                         -- max outcome fee per person per month (null = no cap)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
-- RLS on with no policies: the app can't list or read codes directly.
alter table public.orgs enable row level security;

alter table public.profiles
  add column if not exists org_code text references public.orgs(code);

-- 2) The app joins a code through this function only (returns org name, or null if invalid).
create or replace function public.join_org(p_profile_id text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_name text;
begin
  select name into v_name from orgs where code = v_code and active;
  if v_name is null then
    return null;
  end if;
  update profiles set org_code = v_code where id = p_profile_id;
  return v_name;
end;
$$;
grant execute on function public.join_org(text, text) to anon, authenticated;

-- 3) Leads from the "Book a pilot" form. Anyone can submit; nobody can read via the app.
create table if not exists public.leads (
  id         bigserial primary key,
  name       text not null,
  company    text,
  email      text not null,
  phone      text,
  team_size  text,
  interest   text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
drop policy if exists "anyone can submit a lead" on public.leads;
create policy "anyone can submit a lead" on public.leads
  for insert to anon, authenticated with check (true);

-- 4) Example sponsors (edit, then uncomment):
-- insert into public.orgs (code, name, kind, plan, base_fee_aed, per_move_aed, person_cap_aed) values
--   ('ACME',  'Acme LLC',       'company', 'pilot', 9900, 0, null),   -- Leadership Pilot
--   ('BETA',  'Beta Group',     'company', 'teams', 1500, 4, 60),     -- Reset Teams
--   ('SARAH', 'Coach Sarah',    'coach',   'coach',  349, 0, null);   -- Coach

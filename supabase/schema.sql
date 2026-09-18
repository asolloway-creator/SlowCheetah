-- IOI schema v8 (2026-09-18): comp_plans.industry / company_size_band.
-- Run once in the Supabase SQL editor. Drops v4 comp_plans/deals (demo data).
-- users and its auth trigger are unchanged.
--
-- v4 dropped the per-unit attach product (comp_plans.attach_enabled/attach_name/
-- attach_mrr, deals.attach) — straight SaaS only now; any add-on is bundled
-- into the subscription line.
--
-- v5 drops implementation as its own commission category
-- (comp_plans.implementation_weight, deals.implementation_amount/
-- implementation_discount_pct) — it's a one-time cost like hardware or any
-- other non-recurring line, not a separate weighted bucket; merged into
-- one_time_weight / one_time_amount / one_time_discount_pct.
--
-- v6 adds comp_plans.quarterly_kicker (a second, independent tiered bonus
-- some real plans stack on top of accelerator_style — nullable, most plans
-- don't have one) and deals.saas_commission (the SaaS-only slice of each
-- deal's commission, persisted rather than derived later, so a plan edited
-- mid-quarter doesn't silently reinterpret prior deals' kicker math).
--
-- A live database on an older version keeps the old columns with harmless
-- defaults (the app no longer reads or writes them) unless you run:
--   alter table public.comp_plans drop column attach_enabled, drop column attach_name, drop column attach_mrr, drop column implementation_weight;
--   alter table public.deals drop column attach, drop column implementation_amount, drop column implementation_discount_pct;
--
-- To pick up v6 on a live v5 database WITHOUT dropping existing rows, run
-- instead of the drop/create below:
--   alter table public.comp_plans add column quarterly_kicker jsonb;
--   alter table public.deals add column saas_commission numeric(14,2) not null default 0;
--
-- v7 (2026-09-16): security hardening, no schema change. Postgres grants
-- EXECUTE on a new function to PUBLIC by default; handle_new_user is a
-- trigger function (fires on insert into auth.users, never meant to be
-- called directly) that had never had that default grant revoked, so it
-- sat reachable via /rest/v1/rpc/handle_new_user for anon and authenticated
-- alike. Calling it outside a trigger context errors (`new` is undefined),
-- so this was never exploitable, but there's no reason to leave the surface
-- open — caught by Supabase's own security advisor. Revoking EXECUTE from
-- PUBLIC doesn't touch the trigger itself, which fires as the function's
-- owner (SECURITY DEFINER) regardless of the invoking role's own grants.
-- On a live pre-v7 database, run: revoke execute on function
-- public.handle_new_user() from public, anon, authenticated;
--
-- v8 (2026-09-18) adds comp_plans.industry and comp_plans.company_size_band
-- — both nullable, both optional, foundation for a future opt-in comp
-- benchmarking/cohort view. Deliberately no company-name column: the
-- anonymization policy (cohort by industry+size band only, bucketed
-- numbers, minimum cohort size 5) is documented on the columns below and
-- binding on anything built against them later, not just a suggestion.
--
-- To pick up v8 on a live v7 database WITHOUT dropping existing rows, run
-- instead of the drop/create below:
--   alter table public.comp_plans add column industry text;
--   alter table public.comp_plans add column company_size_band text
--     check (company_size_band is null or company_size_band in (
--       '1-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'
--     ));

create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Not callable directly (see the v7 note above) — only the trigger above
-- invokes it, which runs as the function's owner regardless of this revoke.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop table if exists public.deals;
drop table if exists public.comp_plans;

create table public.comp_plans (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  role_name             text not null,
  period                text not null check (period in ('month','quarter')),
  quota_basis           text not null check (quota_basis in ('units','arr')),
  quota                 numeric(14,2) not null check (quota > 0),
  commission_style      text not null check (commission_style in ('percent','months_of_mrr')),
  base_rate             numeric(8,3)  not null check (base_rate >= 0),
  accelerator_style     text not null check (accelerator_style in ('none','rate_switch','retro_bump')),
  accelerator_threshold numeric(14,2) not null default 0 check (accelerator_threshold >= 0),
  accelerator_rate      numeric(8,3)  not null default 0 check (accelerator_rate >= 0),
  one_time_weight       numeric(6,2)  not null default 50 check (one_time_weight between 0 and 100),
  -- { target: number, tiers: [{attainmentPct, kickerPct}, {attainmentPct, kickerPct}] } or null.
  -- Validated app-side (savePlanAction / parseKicker) rather than in SQL —
  -- same trust boundary as every other plan field here.
  quarterly_kicker      jsonb,
  -- Benchmarking metadata only, both optional — never read by calc.ts or
  -- anything else that computes a payout. See COMPANY_SIZE_BANDS in
  -- calc.ts for the fixed band list; company_size_band is a band, never a
  -- raw headcount, by design. ANONYMIZATION POLICY for any future
  -- cohort/aggregate view built on these columns: group by
  -- (industry, company_size_band) only, NEVER by company (this schema
  -- doesn't capture a company name at all, and that's deliberate) —
  -- bucket numeric outputs (quota bands, OTE ranges) rather than exact
  -- dollars, and suppress any cohort below 5 distinct users. Easier to
  -- hold this line now than to retrofit it once a thin cohort has already
  -- shipped real numbers.
  industry              text,
  company_size_band     text check (company_size_band is null or company_size_band in (
                           '1-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'
                         )),
  created_at            timestamptz not null default now(),
  unique (user_id)
);

-- Snapshots: commission_base is at the base rate (pre-accelerator);
-- commission_earned is what the deal paid at save time (rate_switch applied,
-- retro bump NOT applied - that is computed at the period level).
create table public.deals (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users (id) on delete cascade,
  one_time_amount             numeric(14,2) not null default 0,
  subscription_amount         numeric(14,2) not null default 0,
  subscription_mode           text not null default 'mrr' check (subscription_mode in ('mrr','acv')),
  units                       integer not null default 1 check (units >= 1),
  one_time_discount_pct       numeric(5,2) not null default 0 check (one_time_discount_pct between 0 and 100),
  subscription_discount_pct   numeric(5,2) not null default 0 check (subscription_discount_pct between 0 and 100),
  quota_credit                numeric(14,2) not null default 0,
  arr                         numeric(14,2) not null default 0,
  commission_base             numeric(14,2) not null default 0,
  commission_earned           numeric(14,2) not null default 0,
  money_left_on_table         numeric(14,2) not null default 0,
  -- The SaaS-only slice of commission_earned — all of it for months_of_mrr
  -- plans, the proportional share for percent plans that blend in
  -- one-time. What a quarterly_kicker multiplies against.
  saas_commission             numeric(14,2) not null default 0,
  created_at                  timestamptz not null default now()
);

create index deals_user_created_idx on public.deals (user_id, created_at desc);

alter table public.users      enable row level security;
alter table public.comp_plans enable row level security;
alter table public.deals      enable row level security;

drop policy if exists "users read own"   on public.users;
drop policy if exists "users update own" on public.users;
create policy "users read own"   on public.users      for select using (auth.uid() = id);
create policy "users update own" on public.users      for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "comp_plans own"   on public.comp_plans for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deals own"        on public.deals      for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

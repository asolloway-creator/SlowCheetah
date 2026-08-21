-- IOI x MarginEdge schema. Run once in the Supabase SQL editor.
-- v2 (2026-08-21): replaces the generic cliff-accelerator schema with
-- MarginEdge's real plan shape from Bob. Drops the old comp_plans/deals
-- tables (test data only). users and its auth trigger are unchanged.

-- ── users ────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── v2 replaces the old tables ───────────────────────────────────────────────
drop table if exists public.deals;
drop table if exists public.comp_plans;

-- ── comp_plans ───────────────────────────────────────────────────────────────
-- One row per user. Every number from Bob's spec lives here as editable
-- config, so corrections from Bob are a settings change, not a code change.
create table public.comp_plans (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users (id) on delete cascade,
  role_name               text not null,
  quarterly_arr_quota     numeric(14,2) not null check (quarterly_arr_quota > 0),
  commission_months       numeric(6,2)  not null check (commission_months >= 0),
  accelerator_pct         numeric(6,2)  not null check (accelerator_pct >= 0),
  -- Ask Bob: does the 25% bump apply to package bonuses too? Default no.
  accelerator_on_bonuses  boolean not null default false,
  software_mrr            numeric(10,2) not null check (software_mrr >= 0),
  freepour_mrr            numeric(10,2) not null check (freepour_mrr >= 0),
  bonus_launch            numeric(10,2) not null check (bonus_launch >= 0),
  bonus_boost             numeric(10,2) not null check (bonus_boost >= 0),
  bonus_accelerate        numeric(10,2) not null check (bonus_accelerate >= 0),
  created_at              timestamptz not null default now(),
  unique (user_id)
);

-- ── deals ────────────────────────────────────────────────────────────────────
-- commission_base is stored PRE-accelerator: the 25% bump is retroactive by
-- nature, so it is applied at the quarter-aggregate level, never written back
-- into rows.
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  locations           integer not null default 1 check (locations >= 1),
  freepour            boolean not null default false,
  onboarding_package  text not null check (onboarding_package in ('launch','boost','accelerate')),
  saas_discount_pct   numeric(5,2) not null default 0 check (saas_discount_pct between 0 and 100),
  recipes             integer not null default 0 check (recipes >= 0),
  qbo                 boolean not null default false,
  commissary          boolean not null default false,
  invoice_back_months integer not null default 0 check (invoice_back_months >= 0),
  -- Snapshots at save time:
  mrr                 numeric(14,2) not null default 0,
  arr                 numeric(14,2) not null default 0,
  commission_base     numeric(14,2) not null default 0,
  bonus_amount        numeric(14,2) not null default 0,
  one_time_revenue    numeric(14,2) not null default 0,
  created_at          timestamptz not null default now()
);

create index deals_user_created_idx on public.deals (user_id, created_at desc);

-- ── Row level security ───────────────────────────────────────────────────────
alter table public.users      enable row level security;
alter table public.comp_plans enable row level security;
alter table public.deals      enable row level security;

drop policy if exists "users read own"   on public.users;
drop policy if exists "users update own" on public.users;

create policy "users read own"   on public.users      for select using (auth.uid() = id);
create policy "users update own" on public.users      for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "comp_plans own"   on public.comp_plans for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deals own"        on public.deals      for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

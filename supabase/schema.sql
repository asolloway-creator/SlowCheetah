-- IOI MVP schema. Run this once in the Supabase SQL editor.
-- Three tables only: users, comp_plans, deals. No orgs, no CI module, no SPIF tables.

-- ── users ────────────────────────────────────────────────────────────────────
-- Mirrors auth.users so comp_plans/deals have a FK target in the public schema.
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Keep public.users in sync with auth.users.
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

-- ── comp_plans ───────────────────────────────────────────────────────────────
-- One row per user (the plan is editable, not re-entered per deal).
-- Shape: flat base_rate until accelerator_threshold units in the month, then
-- accelerator_rate applies to the whole deal. See "Known Limitation" in the spec.
create table if not exists public.comp_plans (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  role_name             text not null,
  monthly_unit_quota    integer not null check (monthly_unit_quota > 0),
  base_rate             numeric(6,3) not null check (base_rate >= 0),
  accelerator_threshold integer not null check (accelerator_threshold > 0),
  accelerator_rate      numeric(6,3) not null check (accelerator_rate >= 0),
  -- Not in the spec's field list, but the quota dashboard's ARR pace bar needs a
  -- target to pace against. Nullable: when null the dashboard shows ARR booked
  -- with no goal line instead of a progress bar.
  monthly_arr_quota     numeric(14,2),
  created_at            timestamptz not null default now(),
  unique (user_id)
);

-- ── deals ────────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users (id) on delete cascade,
  one_time_amount             numeric(14,2) not null default 0,
  implementation_amount       numeric(14,2) not null default 0,
  subscription_amount         numeric(14,2) not null default 0,
  subscription_mode           text not null default 'mrr' check (subscription_mode in ('mrr','acv')),
  units                       integer not null default 1 check (units >= 1),
  one_time_discount_pct       numeric(5,2) not null default 0 check (one_time_discount_pct between 0 and 100),
  implementation_discount_pct numeric(5,2) not null default 0 check (implementation_discount_pct between 0 and 100),
  subscription_discount_pct   numeric(5,2) not null default 0 check (subscription_discount_pct between 0 and 100),
  commission_earned           numeric(14,2) not null default 0,
  money_left_on_table         numeric(14,2) not null default 0,
  created_at                  timestamptz not null default now()
);

create index if not exists deals_user_created_idx on public.deals (user_id, created_at desc);

-- ── Row level security ───────────────────────────────────────────────────────
-- Every row is private to its owner. Nobody, including the app operator, reads
-- another user's comp plan or deals through the app.
alter table public.users      enable row level security;
alter table public.comp_plans enable row level security;
alter table public.deals      enable row level security;

drop policy if exists "users read own"       on public.users;
drop policy if exists "users update own"     on public.users;
drop policy if exists "comp_plans own"       on public.comp_plans;
drop policy if exists "deals own"            on public.deals;

create policy "users read own"   on public.users      for select using (auth.uid() = id);
create policy "users update own" on public.users      for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "comp_plans own"   on public.comp_plans for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deals own"        on public.deals      for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

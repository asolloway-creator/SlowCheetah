-- IOI schema v4 (2026-09-10): generic engine, two proven plan shapes.
-- Run once in the Supabase SQL editor. Drops v3 comp_plans/deals (demo data).
-- users and its auth trigger are unchanged.
--
-- v4 drops the per-unit attach product (comp_plans.attach_enabled/attach_name/
-- attach_mrr, deals.attach) — straight SaaS only now; any add-on is bundled
-- into the subscription line. A live database still on v3 keeps those columns
-- with harmless defaults (the app no longer reads or writes them) unless you
-- run:
--   alter table public.comp_plans drop column attach_enabled, drop column attach_name, drop column attach_mrr;
--   alter table public.deals drop column attach;

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
  implementation_weight numeric(6,2)  not null default 50 check (implementation_weight between 0 and 100),
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
  implementation_amount       numeric(14,2) not null default 0,
  subscription_amount         numeric(14,2) not null default 0,
  subscription_mode           text not null default 'mrr' check (subscription_mode in ('mrr','acv')),
  units                       integer not null default 1 check (units >= 1),
  one_time_discount_pct       numeric(5,2) not null default 0 check (one_time_discount_pct between 0 and 100),
  implementation_discount_pct numeric(5,2) not null default 0 check (implementation_discount_pct between 0 and 100),
  subscription_discount_pct   numeric(5,2) not null default 0 check (subscription_discount_pct between 0 and 100),
  quota_credit                numeric(14,2) not null default 0,
  arr                         numeric(14,2) not null default 0,
  commission_base             numeric(14,2) not null default 0,
  commission_earned           numeric(14,2) not null default 0,
  money_left_on_table         numeric(14,2) not null default 0,
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

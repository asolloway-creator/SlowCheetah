-- IOI schema v14 (2026-10-05): a hardware line.
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
--
-- v9 (2026-09-28) adds the admin dashboard (/admin) and anonymous product
-- events. Additive only, safe on a live v8 database as written at the end
-- of this file:
--   - public.admins (who is an admin) + public.is_admin(). Admin rights are
--     data the database enforces, not app code: no service-role key exists
--     anywhere in the app.
--   - "admins read" select policies on comp_plans and deals (OR'd with the
--     existing own-rows policies, so nothing changes for anyone else).
--   - public.events: write-only for the public, readable only by admins.
--     No names, emails or plan numbers. `context` keeps the stock sample
--     deal ('sample') out of real usage ('own', 'account').
--   - admin_accounts() and admin_traffic(): security-definer reads that
--     refuse anyone but an admin.
--
-- v10 (2026-09-30) adds plan records: what people confirm when they describe
-- their plan in their own words (or use the numbers form). Additive only,
-- safe on a live v9 database as written at the end of this file:
--   - public.plan_records: the rules of a plan (plan-record/schema.ts), the
--     version IOI calculates with, how each rule fares in that math, and
--     optional context from fixed lists. Never the words people typed, never
--     a company, never deals, never exact pay. No policies: only the server
--     writes (the ioi-server secret key, the one server-side key in the app,
--     used for nothing else), and admins read through admin_plan_data().
--   - public.rate_limits + take_rate_limit(): request counts for the paid AI
--     reader, keyed by a keyed hash, never a raw network address, and
--     deleted after a day. Callable only by the server.
--   - events.name gains 'plan_read' and 'plan_confirmed'.
--   - admin_plan_data(): the dashboard's plan-data section, one plan per
--     person, same exclusions as admin_traffic().

-- v14 (2026-10-05) splits one-time charges in two. comp_plans.hardware_rate:
-- a flat % of hardware, never accelerated (null when hardware counts with the
-- rest of one-time at one_time_weight). deals and quotes gain hardware_amount
-- and hardware_discount_pct; deals gain hardware_commission, what the hardware
-- paid (part of commission_earned, never of commission_base, so no retro bump
-- touches it). Additive, safe on a live v13 database:
--   alter table public.comp_plans add column if not exists hardware_rate numeric(8,3) check (hardware_rate is null or hardware_rate >= 0);
--   alter table public.deals add column if not exists hardware_amount numeric(14,2) not null default 0 check (hardware_amount >= 0),
--     add column if not exists hardware_discount_pct numeric(5,2) not null default 0 check (hardware_discount_pct between 0 and 100),
--     add column if not exists hardware_commission numeric(14,2) not null default 0;
--   alter table public.quotes add column if not exists hardware_amount numeric(14,2) not null default 0 check (hardware_amount >= 0),
--     add column if not exists hardware_discount_pct numeric(5,2) not null default 0 check (hardware_discount_pct between 0 and 100);
--
-- v13 (2026-10-05) adds comp_plans.accelerator_steps: further accelerator
-- steps past the first (accelerator_threshold / accelerator_rate), same style,
-- each starting past the one before ("12% past $150,000, 15% past $187,500").
-- [{ threshold, rate }, ...] or null; validated app-side (savePlanAction /
-- parseSteps). Quarterly bonus tiers (quarterly_kicker) may now carry an
-- `amount`: a fixed bonus in place of the percent. Additive, safe on a live
-- v12 database:
--   alter table public.comp_plans add column if not exists accelerator_steps jsonb;
--
-- v12 (2026-10-02) adds public.quotes: deals a rep is still working, saved
-- so they can come back to them and see what their open quotes add up to.
-- Same deal columns as public.deals plus the rep's own label. Owner-only RLS
-- like deals, and no admin read policy (a label can hold anything). Booking
-- a quote inserts a deal and deletes the quote. events.name gains
-- 'quote_saved'. Additive, safe on a live v11 database; see the block at the
-- end of this file.
--
-- v11 (2026-10-02) adds comp_plans.opening: what the rep had already booked
-- this period before they started using IOI (calc.ts Opening), so where they
-- stand starts from their real position instead of zero, or, as the demo
-- once did, from invented history. Nullable jsonb, validated app-side, on
-- the working plan (owner-only RLS already covers it), never copied into
-- plan_records. Additive, safe on a live v10 database:
--   alter table public.comp_plans add column if not exists opening jsonb;

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
  -- v13: [{ threshold, rate }, ...] or null. Steps past the first one above.
  accelerator_steps     jsonb,
  one_time_weight       numeric(6,2)  not null default 50 check (one_time_weight between 0 and 100),
  -- v14: hardware's own flat rate, never accelerated; null when it counts with the rest of one-time.
  hardware_rate         numeric(8,3)  check (hardware_rate is null or hardware_rate >= 0),
  -- { target: number, tiers: [{attainmentPct, kickerPct, amount?}, ...] } or null; a tier
  -- with an amount pays that fixed bonus instead of the percent.
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
  -- v11: { periodKey, credit, quarterKey, quarterArr } or null. What the rep
  -- had already booked this period before IOI; ignored once its period ends.
  opening               jsonb,
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
  -- v14: the hardware line, on a plan that pays hardware its own rate.
  hardware_amount             numeric(14,2) not null default 0 check (hardware_amount >= 0),
  hardware_discount_pct       numeric(5,2) not null default 0 check (hardware_discount_pct between 0 and 100),
  hardware_commission         numeric(14,2) not null default 0,
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

-- ---------------------------------------------------------------- v9: admin dashboard + events

create table public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;  -- no policies: readable only by the functions below
insert into public.admins (email) values ('asolloway@gmail.com');

-- Matched on the account's confirmed email in auth.users, not a JWT claim.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins read comp_plans" on public.comp_plans for select to authenticated using ((select public.is_admin()));
create policy "admins read deals"      on public.deals      for select to authenticated using ((select public.is_admin()));

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name in (
    'visit', 'slider_drag', 'bonus_line_crossed', 'plan_form_opened', 'plan_saved', 'deal_booked', 'signin_started'
  )),
  context text not null check (context in ('site', 'sample', 'own', 'account')),
  visitor_id uuid not null,
  session_id uuid not null,
  path text check (char_length(path) <= 200),
  referrer_host text check (char_length(referrer_host) <= 200),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  device text check (device in ('mobile', 'desktop')),
  env text not null check (env in ('production', 'preview', 'development')),
  internal boolean not null default false
);
create index events_created_at_idx on public.events (created_at);
create index events_name_context_created_idx on public.events (name, context, created_at);
alter table public.events enable row level security;
create policy "anyone logs events" on public.events
  for insert to anon with check (created_at between now() - interval '5 minutes' and now() + interval '1 minute');
create policy "admins read events" on public.events
  for select to authenticated using ((select public.is_admin()));

create or replace function public.admin_accounts()
returns table (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean,
  plan jsonb, deals integer, commission numeric, last_deal_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select
    u.id, u.email::text, u.created_at, u.last_sign_in_at,
    exists (select 1 from public.admins a where a.email = lower(u.email)),
    (select to_jsonb(cp) - 'user_id' - 'id' from public.comp_plans cp where cp.user_id = u.id),
    coalesce(d.n, 0)::integer, coalesce(d.commission, 0)::numeric, d.last_at
  from auth.users u
  left join lateral (
    select count(*) as n, sum(dd.commission_earned) as commission, max(dd.created_at) as last_at
    from public.deals dd where dd.user_id = u.id
  ) d on true
  order by u.created_at;
end;
$$;
revoke execute on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

create or replace function public.admin_traffic(since timestamptz, tz text default 'UTC', env_filter text default 'production')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with e as (
    select * from public.events ev
    where ev.created_at >= since and ev.env = env_filter and not ev.internal
  ),
  firsts as (
    select distinct on (e.visitor_id)
      e.visitor_id,
      e.device,
      case
        when nullif(e.utm_source, '') is not null then lower(e.utm_source)
        when coalesce(e.referrer_host, '') = '' or e.referrer_host like '%tryioi.com' then 'direct'
        when e.referrer_host like '%linkedin.com' or e.referrer_host = 'lnkd.in' then 'linkedin'
        when e.referrer_host like '%google.%' then 'google'
        when e.referrer_host like '%facebook.com' or e.referrer_host like '%instagram.com' then 'meta'
        when e.referrer_host like '%x.com' or e.referrer_host = 't.co' or e.referrer_host like '%twitter.com' then 'x'
        else e.referrer_host
      end as source
    from e
    where e.name = 'visit'
    order by e.visitor_id, e.created_at
  )
  select jsonb_build_object(
    'visitors', (select count(distinct e.visitor_id) from e where e.name = 'visit'),
    'sessions', (select count(distinct e.session_id) from e where e.name = 'visit'),
    'page_views', (select count(*) from e where e.name = 'visit'),
    -- Each step counts a visitor once, across contexts where a step spans more than one.
    'journey', (
      select jsonb_build_object(
        'visited', count(distinct e.visitor_id) filter (where e.name = 'visit'),
        'sample_drag', count(distinct e.visitor_id) filter (where e.name = 'slider_drag' and e.context = 'sample'),
        'sample_cross', count(distinct e.visitor_id) filter (where e.name = 'bonus_line_crossed' and e.context = 'sample'),
        'form_opened', count(distinct e.visitor_id) filter (where e.name = 'plan_form_opened' and e.context in ('sample', 'own')),
        'own_saved', count(distinct e.visitor_id) filter (where e.name = 'plan_saved' and e.context = 'own'),
        'signin_started', count(distinct e.visitor_id) filter (where e.name = 'signin_started')
      )
      from e
    ),
    'steps', (
      select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'context', s.context, 'visitors', s.v, 'events', s.n)), '[]'::jsonb)
      from (select e.name, e.context, count(distinct e.visitor_id) as v, count(*) as n from e group by e.name, e.context) s
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'visitors', s.v) order by s.v desc), '[]'::jsonb)
      from (select f.source, count(*) as v from firsts f group by f.source) s
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', s.device, 'visitors', s.v) order by s.v desc), '[]'::jsonb)
      from (select coalesce(f.device, 'unknown') as device, count(*) as v from firsts f group by 1) s
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'visitors', s.v, 'own', s.o) order by s.day), '[]'::jsonb)
      from (
        select (e.created_at at time zone tz)::date as day,
          count(distinct e.visitor_id) filter (where e.name = 'visit') as v,
          count(distinct e.visitor_id) filter (where e.context = 'own') as o
        from e group by 1
      ) s
    ),
    'last_event_at', (select max(ev.created_at) from public.events ev where ev.env = env_filter and not ev.internal),
    'first_event_at', (select min(ev.created_at) from public.events ev where ev.env = env_filter and not ev.internal)
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_traffic(timestamptz, text, text) from public, anon;
grant execute on function public.admin_traffic(timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------- v10: plan records

alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'visit', 'slider_drag', 'bonus_line_crossed', 'plan_form_opened', 'plan_saved', 'deal_booked', 'signin_started',
  'plan_read', 'plan_confirmed'
));

create table public.plan_records (
  id                uuid primary key default gen_random_uuid(),
  confirmed_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- The contributor: an anonymous browser (the analytics visitor id) and,
  -- once signed in, their account. Deleting an account deletes its plans.
  visitor_id        uuid,
  user_id           uuid references public.users (id) on delete cascade,
  origin            text not null check (origin in ('described', 'form')),
  format_version    smallint not null check (format_version >= 1),
  -- Every rule described, calculable or not.
  record            jsonb not null check (jsonb_typeof(record) = 'object' and pg_column_size(record) < 16384),
  -- Conversions the person chose to see numbers now (annual run as quarterly, ...).
  calc_choices      jsonb not null default '{}'::jsonb check (jsonb_typeof(calc_choices) = 'object'),
  -- The version IOI calculates with, derived by fixed rules. Null when it can't run yet.
  calc_plan         jsonb check (calc_plan is null or jsonb_typeof(calc_plan) = 'object'),
  -- calculated / approximated / not_yet / recorded, per rule.
  coverage          jsonb not null default '[]'::jsonb check (jsonb_typeof(coverage) = 'array'),
  -- Why IOI couldn't run the numbers (period_year, measure_tcv, method_flat, ...).
  limits            text[] not null default '{}',
  -- What the AI reader produced before questions and corrections, kept only
  -- when the server's signature on it checks out.
  read_record       jsonb check (read_record is null or jsonb_typeof(read_record) = 'object'),
  read_verified     boolean not null default false,
  reader            jsonb check (reader is null or jsonb_typeof(reader) = 'object'),
  questions         jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  corrections       jsonb not null default '[]'::jsonb check (jsonb_typeof(corrections) = 'array'),
  -- Optional context, fixed lists only. Published figures need 10+ plans per group.
  role_level        text check (role_level in ('sdr', 'ae', 'am', 'csm', 'se', 'manager', 'other')),
  segment           text check (segment in ('smb', 'mid_market', 'enterprise', 'mixed')),
  industry          text check (industry in (
                      'software', 'fintech', 'security', 'devtools', 'healthcare', 'financial_services', 'insurance',
                      'hospitality', 'retail', 'manufacturing', 'logistics', 'media', 'telecom', 'education',
                      'real_estate', 'services', 'hr', 'other')),
  company_size_band text check (company_size_band in ('1-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+')),
  tenure_band       text check (tenure_band in ('lt_1y', '1_2y', '2_4y', '4y_plus')),
  region            text check (region in ('us', 'outside_us')),
  ote_band          text check (ote_band in ('lt_100k', '100_150k', '150_200k', '200_250k', '250_300k', '300k_plus')),
  env               text not null check (env in ('production', 'preview', 'development')),
  internal          boolean not null default false,
  constraint plan_records_contributor check (visitor_id is not null or user_id is not null)
);
create index plan_records_visitor_idx   on public.plan_records (visitor_id, confirmed_at desc);
create index plan_records_user_idx      on public.plan_records (user_id, confirmed_at desc);
create index plan_records_confirmed_idx on public.plan_records (confirmed_at);
alter table public.plan_records enable row level security;  -- no policies
revoke all on table public.plan_records from anon, authenticated;

create table public.rate_limits (
  bucket       text not null check (char_length(bucket) <= 120),
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;  -- no policies
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.take_rate_limit(p_bucket text, p_window_seconds integer, p_max integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  if random() < 0.05 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  insert into public.rate_limits as r (bucket, window_start, hits) values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  return n <= p_max;
end;
$$;
revoke execute on function public.take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;


-- The dashboard's plan-data section: admins only, same exclusions as
-- admin_traffic (non-production, internal devices, admin accounts), one plan
-- per person (their latest).
create or replace function public.admin_plan_data(since timestamptz, tz text default 'UTC', env_filter text default 'production')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with admin_users as (
    select u.id from auth.users u join public.admins a on a.email = lower(u.email)
  ),
  r as (
    select pr.* from public.plan_records pr
    where pr.env = env_filter and not pr.internal
      and (pr.user_id is null or pr.user_id not in (select au.id from admin_users au))
  ),
  latest as (
    select distinct on (coalesce(r.user_id::text, r.visitor_id::text)) r.*
    from r
    order by coalesce(r.user_id::text, r.visitor_id::text), r.confirmed_at desc
  ),
  p as (select * from r where r.confirmed_at >= since)
  select jsonb_build_object(
    'people', (select count(*) from latest),
    'people_new', (select count(*) from latest where latest.confirmed_at >= since),
    'confirmed', (select count(*) from p),
    'described', (select count(*) from p where p.origin = 'described'),
    'form', (select count(*) from p where p.origin = 'form'),
    'calculable', (select count(*) from latest where latest.calc_plan is not null),
    'with_context', (select count(*) from latest where coalesce(latest.role_level, latest.segment, latest.industry,
      latest.company_size_band, latest.tenure_band, latest.region, latest.ote_band) is not null),
    'verified_reads', (select count(*) from p where p.read_verified),
    'corrected_reads', (select count(*) from p where p.read_verified and jsonb_array_length(p.corrections) > 0),
    'shapes', (
      select coalesce(jsonb_agg(jsonb_build_object('period', s.period, 'measure', s.measure, 'method', s.method, 'accel', s.accel, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (
        select l.record->'quota'->>'period' as period,
               l.record->'quota'->>'measure' as measure,
               coalesce(l.record->'pay_rules'->0->>'method', 'unknown') as method,
               coalesce(l.record->'accelerators'->0->>'kind', 'none') as accel,
               count(*) as n
        from latest l group by 1, 2, 3, 4
      ) s
    ),
    'not_yet', (
      select coalesce(jsonb_agg(jsonb_build_object('note', s.note, 'status', s.status, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (
        select c->>'note' as note, c->>'status' as status, count(distinct l.id) as n
        from latest l, jsonb_array_elements(l.coverage) c
        where c->>'status' in ('not_yet', 'approximated', 'recorded')
        group by 1, 2
      ) s
    ),
    'limits', (
      select coalesce(jsonb_agg(jsonb_build_object('limit', s.lim, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (select lim, count(*) as n from latest l, unnest(l.limits) lim group by lim) s
    ),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('feature', s.f, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (
        select f, count(distinct l.id) as n
        from latest l, jsonb_array_elements_text(l.record->'other_features') f
        group by f
      ) s
    ),
    'corrections', (
      select coalesce(jsonb_agg(jsonb_build_object('path', s.path, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (
        select regexp_replace(c->>'path', '\.\d+', '', 'g') as path, count(*) as n
        from p, jsonb_array_elements(p.corrections) c
        where p.read_verified
        group by 1
      ) s
    ),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object('topic', s.topic, 'how', s.how, 'n', s.n) order by s.n desc), '[]'::jsonb)
      from (select q->>'topic' as topic, q->>'how' as how, count(*) as n from p, jsonb_array_elements(p.questions) q group by 1, 2) s
    ),
    'context', jsonb_build_object(
      'role_level', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(role_level, 'unset') as k, count(*) as n from latest group by 1) s),
      'segment', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(segment, 'unset') as k, count(*) as n from latest group by 1) s),
      'industry', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(industry, 'unset') as k, count(*) as n from latest group by 1) s),
      'company_size_band', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(company_size_band, 'unset') as k, count(*) as n from latest group by 1) s),
      'tenure_band', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(tenure_band, 'unset') as k, count(*) as n from latest group by 1) s),
      'region', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(region, 'unset') as k, count(*) as n from latest group by 1) s),
      'ote_band', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(ote_band, 'unset') as k, count(*) as n from latest group by 1) s)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'n', s.n) order by s.day), '[]'::jsonb)
      from (select (p.confirmed_at at time zone tz)::date as day, count(*) as n from p group by 1) s
    ),
    'last_confirmed_at', (select max(r.confirmed_at) from r)
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_plan_data(timestamptz, text, text) from public, anon;
grant execute on function public.admin_plan_data(timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------- v12: open quotes

create table if not exists public.quotes (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.users (id) on delete cascade,
  name                       text not null default '' check (char_length(name) <= 80),
  one_time_amount            numeric(14,2) not null default 0 check (one_time_amount >= 0),
  subscription_amount        numeric(14,2) not null default 0 check (subscription_amount >= 0),
  subscription_mode          text not null default 'mrr' check (subscription_mode in ('mrr','acv')),
  units                      integer not null default 1 check (units >= 1),
  one_time_discount_pct      numeric(5,2) not null default 0 check (one_time_discount_pct between 0 and 100),
  subscription_discount_pct  numeric(5,2) not null default 0 check (subscription_discount_pct between 0 and 100),
  hardware_amount            numeric(14,2) not null default 0 check (hardware_amount >= 0),
  hardware_discount_pct      numeric(5,2) not null default 0 check (hardware_discount_pct between 0 and 100),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists quotes_user_updated_idx on public.quotes (user_id, updated_at desc);
alter table public.quotes enable row level security;
drop policy if exists "quotes own" on public.quotes;
create policy "quotes own" on public.quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'visit', 'slider_drag', 'bonus_line_crossed', 'plan_form_opened', 'plan_saved', 'deal_booked', 'signin_started',
  'plan_read', 'plan_confirmed', 'quote_saved'
));

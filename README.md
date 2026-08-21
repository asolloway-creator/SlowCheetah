# IOI — built for MarginEdge

Private commission and quota tracker, now shaped around MarginEdge's real comp
plan (specs from Bob, 2026-08-21) and styled to their brand. The original
generic build (see git history) followed `claude-code-handoff/ioi-mvp-spec.md`.

## The MarginEdge plan, as built

- **Commission**: 2 months of SaaS per deal. Software $350/mo/location;
  Freepour Smart Scale +$150/mo/location — attaches to every location on a
  deal or none, so an attached deal is $500/mo per location.
- **Quota**: $107,000 new ARR per quarter. Discounted (actual) ARR counts.
- **Accelerator**: crossing quota applies +25% to every deal closed after AND
  retroactively to the quarter's earlier deals. Deals store commission
  pre-accelerator; the bump is applied at the quarter-aggregate level.
- **Onboarding bonuses**: flat per package — Launch $250, Boost $500,
  Accelerate $750 (mapping assumed by price order). Package list prices from
  the published onboarding menus: Launch $500 / Boost $750 / Accelerate $2,000
  first location, +$250 per additional.
- **Side dishes** (recipes $5, QBO $500, commissary $750, invoice
  back-processing $150/mo) count as deal value only.
- Payouts are quarterly today; MarginEdge is shifting to monthly eventually.

### Open questions for Bob

1. Which bonus goes with which package? ($250/$500/$750 assumed by price order.)
2. Does the 25% bump apply to package bonuses, or SaaS commission only?
   (Assumed commission only; `accelerator_on_bonuses` toggle exists in setup.)
3. Do side dishes pay the rep anything? (Assumed no.)

Every number above is editable per-user on the Comp plan screen — corrections
from Bob are a settings change, not a code change.

Next.js (App Router) · Supabase (magic-link auth + Postgres) · Vercel.

---

## Getting it running

**1. Create a Supabase project** at [supabase.com](https://supabase.com) (free tier
is enough). You need to do this part yourself — it involves creating an account.

**2. Run the schema.** In the Supabase dashboard, open **SQL Editor**, paste the
contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates
the three tables, the `auth.users` → `public.users` sync trigger, and row-level
security policies that make every row readable only by its owner.

**3. Point the app at the project.** Copy `.env.local.example` to `.env.local` and
fill in the two values from **Project Settings → API**:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

**4. Allow the redirect.** In **Authentication → URL Configuration**, add
`http://localhost:3000/auth/confirm` to *Redirect URLs* (and the Vercel URL once
deployed).

**5. Run it.**

```bash
npm run dev
```

Sign-in emails go out through Supabase's built-in SMTP, which is rate-limited to a
few messages an hour — fine for one user, worth swapping for a real SMTP provider
if that ever changes.

### Deploying

Push to a Git remote, import the repo in Vercel, set the same two environment
variables in the Vercel project, and add `https://<your-app>.vercel.app/auth/confirm`
to the Supabase redirect list.

---

## What's here, against the spec's milestones

| # | Milestone | Where |
|---|---|---|
| 1 | Login works end to end | [`src/app/login`](src/app/login), [`src/app/auth`](src/app/auth), [`src/proxy.ts`](src/proxy.ts) |
| 2 | A deal persists across sessions | [`src/app/deal/actions.ts`](src/app/deal/actions.ts), [`supabase/schema.sql`](supabase/schema.sql) |
| 3 | Comp plan setup feeds the calculation | [`src/app/setup`](src/app/setup) |
| 4 | Calculation engine + UI ported, reading the saved plan | [`src/lib/calc.ts`](src/lib/calc.ts), [`src/app/deal/DealBuilder.tsx`](src/app/deal/DealBuilder.tsx) |
| 5 | Deal history list | [`src/app/history`](src/app/history) |
| 6 | Quota dashboard from deal history, not manual entry | [`src/app/dashboard`](src/app/dashboard) |

Every route except `/login` and `/auth/*` is gated by [`src/proxy.ts`](src/proxy.ts),
which also refreshes the Supabase session on each request.

## Notes on the port

**The arithmetic is unchanged.** `src/lib/calc.ts` is a line-for-line port of the
prototype's `calc()`. It was checked against the original across 20,000 randomised
deals (280,000 field comparisons) with zero divergence.

**What the engine reads instead of demo data.** The hardcoded `COMP_PLANS` object
is gone; the plan comes from the user's `comp_plans` row. The manually typed
"deals booked this month" field is gone; month-to-date units and ARR are summed
from saved deals (`getMonthToDate` in [`src/lib/queries.ts`](src/lib/queries.ts)).
The prototype's `avgSubDeal` estimate disappears with it — real deal history gives
the actual figure.

**Dropped, per "explicitly not built for this pilot":** the displacement SPIF card
and its tiers, the past-quarter retrospective, the demo role switcher, and CSV
export. The multi-unit toggle collapsed into the plain `units` field it was sugar
over.

**Commission is stored as a snapshot.** `commission_earned` and
`money_left_on_table` are computed server-side at save time against the live
month-to-date position, so a deal booked at the base rate keeps showing the base
rate after the accelerator later kicks in. The client's numbers are recomputed
rather than trusted.

## Two decisions worth knowing about

**`monthly_arr_quota` was added to `comp_plans`.** The spec's field list doesn't
include it, but milestone 6 asks for an ARR *pace*, and pace needs a target. It is
nullable: leave it blank and the dashboard shows ARR booked with no goal line.

**The commissionable-value weights are still constants.** One-time and
implementation revenue count at 50% each, subscription MRR annualizes at 12×
(`COMMISSIONABLE` in [`src/lib/calc.ts`](src/lib/calc.ts)). These were org-level
constants in the prototype and the spec's `comp_plans` table doesn't add them, so
they stayed constants. If a real plan weights line items differently, this is the
first thing that has to move into the database.

## The known limitation, still standing

The engine supports one plan shape: a flat `base_rate` on every deal until
`accelerator_threshold` units land in the month, then `accelerator_rate` on the
whole deal. Tiered brackets, flat-rate-no-accelerator, and per-product rates are
not supported, by decision rather than oversight — see "Known Limitation" in the
spec. The comp plan screen says as much to the user.

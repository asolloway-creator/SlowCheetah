# IOI — Information over incentive

**tryioi.com.** See the whole deal before the offer is made: your comp plan,
quota and accelerator live on every deal. Drag a discount and watch exactly
what it costs you.

Next.js (App Router) · Supabase (magic-link auth + Postgres) · Vercel.

## How it's shaped

**Demo-first.** The landing page *is* the deal builder, running against a
sample plan and a seeded mid-quarter position in the visitor's browser
(`localStorage`, nothing leaves the machine). Every screen works without an
account. Signing in is the "keep this across devices" upsell; signed-in users
get the same UI against their own private rows (RLS-scoped).

**One engine, two proven plan shapes** ([src/lib/calc.ts](src/lib/calc.ts)).
Generalized only as far as the real plans we've seen:
- *Units + rate switch*: monthly unit quota, commission as a % of
  commissionable value (one-time and implementation at a configurable weight),
  rate switches to an accelerated % once a unit threshold lands.
- *ARR + retroactive bump*: quarterly new-ARR quota, commission as N months of
  MRR, a % bump applied to the whole period — earlier deals included — once
  quota is crossed. Optional per-unit attach product that feeds MRR and quota.
- *Flat*: one rate, quota tracked, no accelerator.

Presets for each ship on the Comp plan screen; every number stays editable.
The engine is parity-tested against both original implementations
(45,000 field checks for the v1 shape, the full MarginEdge case set for v2).

**The signature moments.** Hold the Line shows money left on the table per
deal, and calls it out when a discount is the thing keeping a rep under their
accelerator. The attach toggle shows exactly what attaching is worth on this
deal — including when it's the difference between crossing quota and not.

**Storage.** Deals store `commission_base` (base rate) and `commission_earned`
(as paid at booking). Retroactive bumps are applied at the period level, never
written back into rows.

## Running it

```bash
cp .env.local.example .env.local   # Supabase URL + publishable key
npm install && npm run dev
```

Schema: run [supabase/schema.sql](supabase/schema.sql) once in the Supabase
SQL editor. Add `<origin>/auth/confirm` to Supabase's redirect URL allowlist
for every origin you serve from.

Deploys: push to `main` → Vercel builds → live. OG image is generated at
[src/app/opengraph-image.tsx](src/app/opengraph-image.tsx).

## Not every plan fits yet

The three preset shapes cover a real, mainstream slice of quota-carrying roles,
but a rigorous pass (2026-09-10) found several common comp plan shapes the
engine can't represent: tiered/graduated commission (marginal-rate brackets,
not a cliff), multiple accelerator tiers, per-SKU rates, renewals/expansion
comp, stacked SPIFs, multiple simultaneous quotas, ramp schedules, non-USD,
and periods other than month/quarter. Tiered commission is the most common
gap and the next one worth closing if a real plan needs it.

**Next feature, scoped but not built:** let a rep describe their plan in free
text and have an LLM map it onto the *existing* `CompPlan` fields — a better
front door to the same three shapes, not a new calculation engine. The
plain-English readout at the top of `/plan` is the natural confirmation
surface: show what was understood before anything is saved, same as a human
would double-check it. When the description doesn't fit any current shape,
say so rather than force-fitting it — that's the same "tell me where this
broke" signal as the footer hook, now structured. Explicitly out of scope:
having an LLM generate calculation logic per user for unsupported shapes —
too risky for a tool whose whole premise is a number you can trust; a
subtly-wrong AI-generated formula computed silently against someone's real
paycheck is close to the worst failure mode available here. Building this
also means updating the "nothing you enter is shared" footer copy, since the
free-text description would go to a third-party API (Anthropic) to parse.

## History

- v1: generic build to `claude-code-handoff/ioi-mvp-spec.md` for a single
  private user; engine ported from the reference prototype.
- v2: reshaped around MarginEdge's real plan (see git history) — where the
  retroactive accelerator, attach nudge, and "crossing is worth $X" framing
  came from.
- v3: public, demo-first, both shapes unified. The first two visual passes
  (a dark terminal look, then a font swap on the same layout) were rejected as
  amateur; the shipped design came from a critique → brief → four directions →
  judged process. Warm paper, Inter with tabular figures, one hue reserved for
  money leaving, the quarter drawn as a line, and an opening state engineered
  so a 5% discount is what holds the rep under their accelerator.

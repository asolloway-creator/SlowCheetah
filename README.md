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
  commissionable value (one-time products at a configurable weight), rate
  switches to an accelerated % once a unit threshold lands.
- *ARR + retroactive bump*: quarterly new-ARR quota, commission as N months of
  MRR, a % bump applied to the whole period — earlier deals included — once
  quota is crossed.
- *Flat*: one rate, quota tracked, no accelerator.

Straight SaaS only — no separate per-unit add-on product. Any add-on is
bundled into the subscription line like any other price increase, not
tracked as its own thing; a dedicated attach toggle existed through v3 and
was removed as a redundant complication (2026-09-10).

One-time products is a single bucket — hardware, implementation, setup fees,
whatever a plan charges once. Implementation used to be its own parallel
category with its own weight and discount slider; dropped (2026-09-10) once
it turned out every real preset weighted it identically to one-time products
anyway, and the real MarginEdge plan (`months_of_mrr`) never commissioned
either one — implementation as a separately-tracked payout category was
never actually confirmed as part of Bob's plan and is now removed from the
payout math entirely, not just hidden.

Presets for each ship on the Comp plan screen; every number stays editable.
The engine is parity-tested against both original implementations
(45,000 field checks for the v1 shape, the full MarginEdge case set for v2).

**The signature moments.** Hold the Line shows money left on the table per
deal, and calls it out when a discount is the thing keeping a rep under their
accelerator.

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

**Scope for tiered commission, when it's next up (2026-09-10):** a third
`commission_style: 'tiered'` — not another `accelerator_style`, since a
tiered plan has no separate base rate, the brackets are the rate structure.
`accelerator_style` forced to `'none'` alongside it for v1; stacking a
retroactive bump or rate switch on top of tiers is a real thing some plans
do, but scoping it now would be guessing at a shape nobody's confirmed yet.
Needs: a new `tiers: {upTo, rate}[]` shape (a JSONB column on `comp_plans`,
since every other field is a fixed scalar), a proportional bracket-split
calculation for a deal that straddles more than one tier (needs its own
exhaustive test suite — this is the one piece of new math and it has to be
exactly right), a variable-length tier-list editor component (add/remove/
reorder rows — no existing form pattern in the app does this), a fourth
preset, and new deal-page narrative copy — "Hold the Line" is built around
one dramatic threshold crossing, and tiered plans don't have that moment;
a discount still costs something (less of the deal lands in the top
bracket), but it needs its own sentence, not a copy tweak on the existing
one. Roughly a half-day of careful work; the math correctness and the new
narrative are where the time goes, not the fields.

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
- v4 (2026-09-11): demo's front door moved from the quarterly ARR retroactive
  plan to the monthly unit rate-switch plan. Reasoning: the retroactive plan
  is structurally thin (one metric, no weighting) despite being conceptually
  surprising; the rate-switch plan is closer to a real, structurally complex
  comp plan (revenue weighted by type, a separate quota metric) and a better
  demonstration of "decode a complex plan" for someone evaluating this for
  their org, not just a rep looking for a personal surprise. New opening
  state: 6 of 8 monthly units booked, a 2-unit deal that crosses the
  threshold on its own, discounted 20% on one-time products specifically —
  the discount looks steep to the customer but barely touches commission,
  because one-time revenue counts at only 40% weight here. That gap between
  sticker cost and commission cost only exists because the plan weights
  revenue types differently, which the old single-metric plan couldn't show.
- Demo → signup import: a visitor who customizes their plan in the
  browser-only demo and then signs up no longer loses it. `/plan` mounts
  `ImportDemoPlan` above the blank-state form
  ([plan/page.tsx](src/app/plan/page.tsx)) whenever a signed-in user has no
  saved plan; it does a side-effect-free `peekDemoState()` read
  ([demo.ts](src/lib/demo.ts)) of the `ioi-demo-v3` localStorage key,
  compares the stored plan against `DEMO_PLAN`, and — only if it was
  actually touched — offers "Import it" (`importDemoPlanAction`, a thin
  wrapper around `savePlanAction`) or "Start fresh," clearing the key
  either way so the banner never reappears. Plan only, not deals: the
  demo's 5 seeded rows are scripted narrative for the Hold-the-Line moment,
  not real commission history, and importing them into a real account
  would plant fake numbers there.

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
  quota is crossed.
- *Flat*: one rate, quota tracked, no accelerator.

Straight SaaS only — no separate per-unit add-on product. Any add-on is
bundled into the subscription line like any other price increase, not
tracked as its own thing; a dedicated attach toggle existed through v3 and
was removed as a redundant complication (2026-09-10).

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

## Scope for demo → signup migration

Found during a launch-readiness audit (2026-09-10): signing in currently
throws away whatever the visitor built in the demo. `LoginForm` only calls
`supabase.auth.signInWithOtp` — nothing captures the browser's demo state
first — and `/auth/confirm` is a server route that exchanges the magic-link
code for a session and redirects; it never touches `localStorage`, which is
browser-only and wouldn't be reachable there regardless. A visitor who
spends two minutes shaping their plan on the demo, likes it, and signs up to
save it lands on a blank `/plan` and has to redo it from nothing. For a
cold LinkedIn audience this is the exact moment that loses people — it's the
strongest concrete lead on why the tool still feels like "too much
complexity," more than any single form field.

**Where it hooks in.** Every signed-in user with no saved plan already
funnels through one place: `/` redirects to `/plan` when `getCompPlan`
returns null ([page.tsx:14](src/app/page.tsx)), and `/plan` now renders a
genuinely blank `PlanSentence` in that case (this session's $100k-default
fix). That blank-state render is the one spot that needs to check for
leftover demo work and offer it back — no changes needed to the login form,
the magic-link route, or the auth flow itself.

**Detecting "worth importing."** `useDemoStore`'s `fresh()` always writes
`{ plan: DEMO_PLAN, deals: seedDeals(DEMO_PLAN), seeded: true }` — the
`seeded` field was clearly meant to distinguish "still the untouched sample"
from "visitor changed something," but nothing ever flips it to `false` on
`saveDeal`/`savePlan`, so it's dead weight today. Detection needs to compare
the stored state against that pristine baseline instead — the same check
`DemoDeal`'s dev-only sanity effect already does
([DemoViews.tsx:24](src/app/demo/DemoViews.tsx)): plan unchanged from
`DEMO_PLAN` and deals still exactly the 6 seeded ones means "never touched,"
skip the prompt entirely and land on the ordinary blank form. Reading it
also can't go through `useDemoStore()` itself — that hook seeds a fresh demo
state as a side effect if none exists, which would incorrectly spin up demo
data inside a real signed-in session. Needs a small read-only peek
(`localStorage.getItem('ioi-demo-v3')`, parsed, no fallback to `fresh()`)
instead.

**What gets imported, v1: plan only.** The customized plan is the thing
worth two minutes of setup — that's the actual loss. Deals are a separate,
harder call: the 6 seeded rows are scripted narrative for the Hold-the-Line
demo (a fabricated "87% to quota, mid-quarter" rep), not anything resembling
the visitor's real commission history, and importing them as if they were
real deals would put fake numbers in someone's real account. A visitor who
added their *own* deals on top of the seed is a real but probably rare case
this session didn't dig into — leave deal import out of v1 and revisit only
if it turns out people actually do this before signing up.

**Confirm, don't auto-import.** Consistent with how the rest of the app
treats a plan as something to double-check before it's saved (the
plain-English readout exists for exactly this reason) — this should be a
banner above the blank form, "We found the plan you set up before signing
in — import it?" with Import / Start fresh, not a silent write. It's someone
else's comp numbers going into their real account; showing what would be
imported before it happens matches the app's own standard elsewhere.

**Server side.** A new `importDemoPlanAction(plan: CompPlan)` next to
`savePlanAction` in [actions.ts](src/app/actions.ts) — same validation
(`role_name` required, `quota > 0`, numeric finiteness), same
`comp_plans` upsert. Reusing `savePlanAction` directly would work too; a
separate action only earns its keep if the confirm step needs to say
anything about the import specifically (e.g. distinct success copy).

**Cleanup.** After Import or Start fresh, clear the `ioi-demo-v3`
`localStorage` key (or reset it via the store's existing `reset()`) and set
a one-time dismissed flag so the banner never reappears — otherwise a
sign-out on the same browser resurrects a now-orphaned customized demo
instead of a clean anonymous one.

Roughly an hour: the detection/peek helper and the banner component are the
new surface area; the server action is a near-copy of `savePlanAction`.
Worth doing before a real LinkedIn push — it's the one gap that directly
undermines the demo-first pitch (try it free, keep it forever) rather than
just being an uncovered edge case.

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

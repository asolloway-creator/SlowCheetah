import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { Doc, DocSection } from '@/components/Doc';

export const metadata = {
  title: 'How IOI uses plans · IOI',
  description: 'What IOI keeps when you put your plan in, what it never asks for, and how the anonymous comparison works.',
};

export default async function PlansAndPrivacyPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/plans-and-privacy" email={user?.email ?? null} width="plan">
      <Doc
        title="Your plan decides your pay. You should be able to read it."
        lede="Most reps learn how their comp plan really works one paycheck at a time. IOI reads your plan back to you and shows what each deal pays before you sign it. With your plan in, it can also show how plans like yours pay across the market, without ever showing anyone yours."
        updated="September 30, 2026"
      >
        <DocSection title="What IOI keeps">
          <ul>
            <li>
              <b>Your plan’s rules.</b> How quota is measured, what a deal pays, where accelerators start, bonuses, caps
              and the like, kept as numbers in a fixed format.
            </li>
            <li>
              <b>Context you choose to add.</b> Your role, who you sell to, industry, company size, time in role, whether
              you’re in the US, and an earnings range. All optional.
            </li>
            <li>
              <b>A way to find your plan again.</b> A random ID stored in your browser, and your account if you’re signed
              in, so you can change or remove it later.
            </li>
          </ul>
        </DocSection>

        <DocSection title="What IOI never keeps, and never asks for">
          <ul>
            <li>
              <b>Your words.</b> What you type or say goes to Claude, Anthropic’s AI, to be read into those rules. Then
              it’s discarded. IOI doesn’t store it or log it.
            </li>
            <li>
              <b>Your company, or anyone’s name.</b> There’s no field for it, and names are stripped from anything read.
            </li>
            <li>
              <b>Your plan document.</b> IOI asks how you’re paid, in your own words. Please don’t paste your employer’s
              documents.
            </li>
            <li>
              <b>Your deals.</b> Deal sizes, prices and discounts stay yours. They never join the comparison.
            </li>
            <li>
              <b>Your exact pay.</b> Earnings are asked as a range, and only if you want to.
            </li>
          </ul>
        </DocSection>

        <DocSection title="How the comparison works">
          <ul>
            <li>Only plans people confirm count, and only one per person: the latest.</li>
            <li>Nothing is shown for any group smaller than 10 plans, whichever way the plans are sliced.</li>
            <li>Amounts like quotas only ever appear as ranges.</li>
            <li>
              IOI may publish or sell combined, anonymous findings, such as how common retroactive accelerators are among
              mid-market AEs. IOI never sells or shares an individual plan.
            </li>
          </ul>
          <p>
            These are reps’ own accounts of their plans, not payroll records, and every comparison will say so.
          </p>
        </DocSection>

        <DocSection title="Your plan is yours to talk about">
          <p>
            A commission plan is part of how you’re paid. In the US, most private-sector employees have a legally
            protected right to discuss their own pay, and the National Labor Relations Board explains it on{' '}
            <a href="https://www.nlrb.gov/about-nlrb/rights-we-protect/your-rights/your-rights-to-discuss-wages" rel="noreferrer">
              its page on discussing wages
            </a>
            . That protection doesn’t cover everyone, including many managers.
          </p>
          <p>
            That’s why IOI asks for the rules of your pay and nothing about your employer’s business: no customer names, no
            pricing, no company results. If your role or agreement limits what you can share, share only what you’re
            comfortable with, or use IOI without confirming a plan.
          </p>
        </DocSection>

        <DocSection title="Taking it back">
          <p>
            <b>Forget my plan</b>, on <Link href="/plan">your plan page</Link>, removes every plan you’ve shared from this
            browser or account. Figures already published can’t be un-counted, but nothing new is ever built from your
            plan again.
          </p>
        </DocSection>

        <DocSection title="Who helps run IOI">
          <ul>
            <li>
              <b>Anthropic</b> reads plan descriptions (Claude).
            </li>
            <li>
              <b>Supabase</b> stores plans, accounts and saved deals.
            </li>
            <li>
              <b>Vercel</b> runs the site.
            </li>
            <li>
              <b>Resend</b> sends sign-in emails.
            </li>
          </ul>
          <p>
            The full picture is in the <Link href="/privacy">privacy policy</Link> and the <Link href="/terms">terms</Link>.
          </p>
        </DocSection>
      </Doc>
    </Shell>
  );
}

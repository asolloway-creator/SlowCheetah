import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { Doc, DocSection } from '@/components/Doc';

export const metadata = {
  title: 'How IOI handles your plan · IOI',
  description: 'What IOI keeps when you put your plan in, what it never asks for, and how to remove or delete it.',
};

export default async function PlansAndPrivacyPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/plans-and-privacy" email={user?.email ?? null} width="plan">
      <Doc
        title="How IOI handles your plan"
        lede="Commission software is built for the company: it tracks what you’re owed once a deal is done. IOI is built for you. It shows what a deal pays before you sign it, what a discount will cost you, and where your next accelerator is. To do that it needs your plan’s rules, and it treats them carefully."
        updated="September 30, 2026"
      >
        <DocSection title="What IOI keeps">
          <ul>
            <li>
              <b>Your plan’s rules.</b> How quota is measured, what a deal pays, where accelerators start, bonuses and
              limits, kept as numbers.
            </li>
            <li>
              <b>Anything extra you choose to add.</b> Your role, who you sell to, industry, company size, time in role,
              and an earnings range. All optional.
            </li>
            <li>
              <b>A way to find your plan again.</b> A random ID in your browser, or your account if you’re signed in.
            </li>
          </ul>
        </DocSection>

        <DocSection title="What IOI never asks for">
          <ul>
            <li>
              <b>Your plan document</b>, or anything else from your employer. IOI asks how you’re paid, in your own words.
            </li>
            <li>
              <b>Your company’s name</b>, your customers, or anyone’s name.
            </li>
            <li>
              <b>Your deals.</b> Deal sizes, prices and discounts stay with you.
            </li>
            <li>
              <b>Your exact pay.</b> Earnings are a range, and optional.
            </li>
          </ul>
          <p>
            When you describe your plan, an AI service reads your words into those rules. Then they’re discarded.
          </p>
        </DocSection>

        <DocSection title="How your plan is used">
          <p>
            It runs your numbers in IOI. Plans are also combined anonymously to improve IOI and in its products and
            reports. No one ever sees yours, and IOI never shares or sells an individual plan.
          </p>
          <p>
            <b>Remove my plan</b>, on <Link href="/plan">your plan page</Link>, removes every plan you’ve shared. Signed in,
            you can also delete your account from the <Link href="/privacy">privacy page</Link>.
          </p>
        </DocSection>
      </Doc>
    </Shell>
  );
}

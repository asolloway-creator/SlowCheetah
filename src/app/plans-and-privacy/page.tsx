import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { Doc, DocSection } from '@/components/Doc';

export const metadata = {
  title: 'How IOI handles your plan · IOI',
  description: 'What IOI keeps when you put your plan in, what stays out of it, and how to remove or delete it.',
};

export default async function PlansAndPrivacyPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/plans-and-privacy" email={user?.email ?? null} width="plan">
      <Doc
        title="How IOI handles your plan"
        lede="Commission software is built for the company: it tracks what you’re owed once a deal is done. IOI is built for you. It shows what a deal pays before you sign it, what a discount will cost you, and where your next accelerator is. To do that it needs your plan’s rules, and it treats them carefully."
        updated="October 5, 2026"
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
              <b>A way to find your plan again.</b> Your account, and a random ID in your browser.
            </li>
          </ul>
        </DocSection>

        <DocSection title="What stays out">
          <ul>
            <li>
              <b>Your plan document</b>, or anything else from your employer. IOI asks how you’re paid, in your own words.
            </li>
            <li>
              <b>Your company’s name</b>, your customers, or anyone’s name. IOI never asks for them.
            </li>
            <li>
              <b>Your deals.</b> What you enter on the deal page is never part of your plan. It stays in your account.
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

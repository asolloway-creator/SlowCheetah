import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { Doc, DocSection } from '@/components/Doc';

export const metadata = {
  title: 'Terms · IOI',
  description: 'The terms for using IOI and for the plans you choose to share.',
};

export default async function TermsPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/terms" email={user?.email ?? null} width="plan">
      <Doc
        title="Terms"
        lede="Using IOI means agreeing to these terms. They’re short on purpose."
        updated="September 30, 2026"
      >
        <DocSection title="IOI’s numbers are estimates">
          <p>
            IOI runs the plan and deals you enter through its own math. That’s useful for seeing what a deal and a discount
            are worth, but it isn’t payroll. Your employer’s plan and payroll decide what you’re actually paid, and IOI can’t
            promise its numbers match them.
          </p>
        </DocSection>

        <DocSection title="Sharing your plan">
          <p>When you confirm a plan, you’re telling IOI that:</p>
          <ul>
            <li>it describes your own pay, as best you know it;</li>
            <li>you’re allowed to share it, and sharing it doesn’t break a confidentiality duty you owe anyone;</li>
            <li>
              it doesn’t include your employer’s documents or confidential business information, such as customer names,
              pricing or financial results, or anyone’s name.
            </li>
          </ul>
        </DocSection>

        <DocSection title="What IOI may do with confirmed plans">
          <p>
            Confirmed plans are kept as rules and numbers, without your words, your company or your deals, as described in{' '}
            <Link href="/plans-and-privacy">how IOI uses plans</Link>. You give IOI a permanent, worldwide, royalty-free
            right to use them in combined, anonymous form: to show comparisons and benchmarks, to improve IOI, and in reports
            IOI may publish or sell.
          </p>
          <p>
            IOI never sells or shares an individual plan and never shows a group of fewer than 10 plans. You can remove your
            plan from future use at any time with <b>Forget my plan</b>.
          </p>
        </DocSection>

        <DocSection title="Using IOI fairly">
          <p>
            Don’t scrape IOI, overload it, try to get around its limits, or feed it plans that aren’t real. Keep the email
            account you sign in with secure, since sign-in links go there.
          </p>
        </DocSection>

        <DocSection title="The usual">
          <p>
            IOI is provided as is, without warranties of any kind. To the extent the law allows, IOI isn’t liable for
            decisions made using its numbers, or for indirect or consequential losses. These terms may change; the current
            version always lives here, with its date.
          </p>
        </DocSection>
      </Doc>
    </Shell>
  );
}

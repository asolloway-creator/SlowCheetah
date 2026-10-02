import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { Doc, DocSection } from '@/components/Doc';
import DeleteAccount from '@/components/DeleteAccount';

export const metadata = {
  title: 'Privacy · IOI',
  description: 'What IOI collects, why, who helps run it, and how to remove what you’ve shared.',
};

export default async function PrivacyPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/privacy" email={user?.email ?? null} width="plan">
      <Doc
        title="Privacy"
        lede="IOI is a small, independent tool. This is what it collects, why, and who helps run it. The short version: your deals stay yours, your words are never kept, and your plan is only ever counted anonymously."
        updated="October 2, 2026"
      >
        <DocSection title="Without an account">
          <p>
            The plan and deals you enter, and what you tell IOI you’d already booked, live in your browser. They aren’t sent to IOI unless you confirm
            your plan, which files its rules anonymously as described in{' '}
            <Link href="/plans-and-privacy">how IOI handles your plan</Link>.
          </p>
        </DocSection>

        <DocSection title="When you describe your plan">
          <p>
            What you type or say is sent to an AI service that reads it into your plan’s rules, then it’s discarded. IOI
            doesn’t store it or write it to logs. If you use the mic, your browser turns your speech into text first, and IOI
            only receives the text.
          </p>
        </DocSection>

        <DocSection title="With an account">
          <p>
            Signing in keeps your email address, your plan, the deals you save and what you’d already booked, so they’re there on any device. Sign-in
            works by emailed link; there’s no password.
          </p>
        </DocSection>

        <DocSection title="Usage">
          <p>
            IOI records which moments happen: a visit, dragging the discount slider, putting a plan in, booking a deal. It
            notes the page, the site that sent you and whether you’re on a phone or a computer, tied to a random ID in your
            browser. Never names, email addresses, plan numbers or deal numbers. There are no advertising or third-party
            analytics cookies, and IOI doesn’t follow you across other sites.
          </p>
          <p>
            To keep the plan reader from being abused, IOI counts requests using a scrambled version of your network address
            that can’t be turned back into it. Those counts are deleted within a day.
          </p>
        </DocSection>

        <DocSection title="Who helps run IOI">
          <ul>
            <li>
              <b>An AI service</b> reads plan descriptions.
            </li>
            <li>
              <b>A database service</b> stores accounts, saved plans and deals, and anonymous plan rules.
            </li>
            <li>
              <b>A hosting service</b> runs the site.
            </li>
            <li>
              <b>An email service</b> sends sign-in emails.
            </li>
          </ul>
          <p>IOI doesn’t sell personal information, and doesn’t share it except with these services to run IOI.</p>
        </DocSection>

        <DocSection title="Remove or delete">
          <ul>
            <li>
              <b>Remove my plan</b> on <Link href="/plan">your plan page</Link> removes every plan you’ve shared.
            </li>
            <li>
              <b>Delete my account</b>, below when you’re signed in, removes your account and everything saved with it,
              including every plan you’ve shared. You can also email{' '}
              <a href="mailto:privacy@tryioi.com?subject=IOI%3A%20delete%20my%20account">privacy@tryioi.com</a> from the
              address you sign in with, and it’s done within 30 days.
            </li>
            <li>Clearing this site’s data in your browser removes the plan and deals kept there.</li>
          </ul>
          {user && <DeleteAccount />}
        </DocSection>

        <DocSection title="The rest">
          <p>
            IOI isn’t meant for anyone under 18. If this policy changes, the new version goes here with a new date, and a
            change in how plans are used will be announced on the site first.
          </p>
        </DocSection>
      </Doc>
    </Shell>
  );
}

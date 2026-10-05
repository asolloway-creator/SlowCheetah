'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';

function Pending() {
  const { pending } = useLinkStatus();
  return <span className={`nav-pending${pending ? ' is-pending' : ''}`} aria-hidden="true" />;
}

/**
 * A masthead link that shows the click landed while the next page renders.
 * Every page reads the session first, so a slow connection would otherwise
 * mean a click with nothing to show for it.
 */
export default function NavLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Pending />
    </Link>
  );
}

import Masthead from '@/components/Masthead';
import Footer from '@/components/Footer';
import RememberAccount from '@/components/RememberAccount';

export type ShellWidth = 'wide' | 'narrow' | 'table' | 'plan' | 'auth' | 'full';

const WIDTH: Record<ShellWidth, string> = {
  wide: '',
  narrow: 'container-narrow',
  table: 'container-table',
  plan: 'container-plan',
  auth: 'container-auth',
  full: '',
};

/**
 * The one page shell: masthead, main, footer. Demo and signed-in share it.
 * `full` hands the whole width to the page (the deal page's sections run
 * edge to edge and set their own containers).
 */
export function Shell({
  current,
  email,
  width = 'wide',
  own = false,
  pending = false,
  children,
}: {
  current: string;
  email: string | null;
  width?: ShellWidth;
  /** Signed out, with a plan of their own in this browser (the demo store). */
  own?: boolean;
  /**
   * Signed out, before the browser store has loaded: the page shows what a
   * visitor without a plan of their own sees, which a visitor with one
   * shouldn't (lib/demo-flag.ts).
   */
  pending?: boolean;
  children: React.ReactNode;
}) {
  const layout = width === 'full' ? 'main-full' : `container ${WIDTH[width]}`;
  return (
    <>
      {email && <RememberAccount />}
      <Masthead current={current} email={email} own={own} pending={pending} />
      <main className={pending ? `${layout} is-pending` : layout}>{children}</main>
      <Footer />
    </>
  );
}

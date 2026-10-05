import Masthead from '@/components/Masthead';
import Footer from '@/components/Footer';

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
  children,
}: {
  current: string;
  email: string | null;
  width?: ShellWidth;
  children: React.ReactNode;
}) {
  const layout = width === 'full' ? 'main-full' : `container ${WIDTH[width]}`;
  return (
    <>
      <Masthead current={current} email={email} />
      <main className={layout}>{children}</main>
      <Footer />
    </>
  );
}

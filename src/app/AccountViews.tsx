import Masthead from '@/components/Masthead';
import Footer from '@/components/Footer';

export type ShellWidth = 'wide' | 'narrow' | 'table' | 'plan' | 'auth';

const WIDTH: Record<ShellWidth, string> = {
  wide: '',
  narrow: 'container-narrow',
  table: 'container-table',
  plan: 'container-plan',
  auth: 'container-auth',
};

/** The one page shell: masthead, main, footer. Demo and signed-in share it. */
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
  return (
    <>
      <Masthead current={current} email={email} />
      <main className={`container ${WIDTH[width]}`}>{children}</main>
      <Footer widthClass={WIDTH[width]} />
    </>
  );
}

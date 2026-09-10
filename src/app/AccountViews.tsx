import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';

export function AccountShell({ current, email, children }: { current: string; email: string; children: React.ReactNode }) {
  return (
    <div className="app">
      <Masthead current={current} email={email} />
      {children}
      <Footnote />
    </div>
  );
}

import type { ReactNode } from 'react';

export type LedgerRow = {
  label: string;
  value: ReactNode;
  suffix?: string;
  tone?: 'red' | 'dim';
};

/** A quiet body-size ledger: label left, tabular value right, hairlines between. */
export default function Ledger({ rows, className }: { rows: LedgerRow[]; className?: string }) {
  return (
    <dl className={`ledger${className ? ` ${className}` : ''}`}>
      {rows.map((r) => (
        <div className="ledger-row" key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            <span className={`ledger-value${r.tone ? ` is-${r.tone}` : ''}`}>{r.value}</span>
            {r.suffix && <span className="ledger-suffix">{r.suffix}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

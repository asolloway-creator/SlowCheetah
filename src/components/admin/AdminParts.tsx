import type { CSSProperties, ReactNode } from 'react';

const vars = (o: Record<string, string>) => o as CSSProperties;
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

/** "Sample" or "Real": said in words, never by colour alone. */
export function Tag({ kind }: { kind: 'sample' | 'real' }) {
  return <span className={`admin-tag is-${kind}`}>{kind === 'sample' ? 'Sample deal' : 'Real'}</span>;
}

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat-tile">
      <p className="stat-tile-label">{label}</p>
      <p className="stat-tile-value">{value}</p>
      {note && <p className="stat-tile-note">{note}</p>}
    </div>
  );
}

/** Round up to a clean number (10, 15, 20, 30, 40, 60, 80...) so gridlines sit on round values without much headroom. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const step = [1, 1.5, 2, 3, 4, 6, 8, 10].find((c) => m <= c) ?? 10;
  return step * p;
}

/**
 * One series of columns over days. Single series, so no legend: the title
 * names it. Each column is focusable and carries its own tooltip; the peak is
 * labelled on its cap; the full series is in the table underneath.
 */
export function DailyChart({ points, unit, emptyText }: { points: { label: string; value: number }[]; unit: string; emptyText: string }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  if (max === 0) return <p className="admin-empty">{emptyText}</p>;
  const top = niceMax(max);
  const peak = points.findIndex((p) => p.value === max);
  const plural = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? unit : `${unit}s`}`;
  return (
    <figure className="chart">
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden="true">
          <span style={vars({ '--y': '100%' })}>{top.toLocaleString('en-US')}</span>
          <span style={vars({ '--y': '50%' })}>{(top / 2).toLocaleString('en-US')}</span>
          <span style={vars({ '--y': '0%' })}>0</span>
        </div>
        <div className="chart-cols" style={vars({ '--n': String(points.length) })}>
          {points.map((p, i) => (
            <div key={p.label} className="chart-col" tabIndex={0} aria-label={`${p.label}: ${plural(p.value)}`}>
              <span className="chart-bar" style={vars({ '--h': `${(p.value / top) * 100}%` })}>
                {i === peak && <span className="chart-peak">{p.value.toLocaleString('en-US')}</span>}
              </span>
              <span className="chart-tip" aria-hidden="true">
                <b>{p.value.toLocaleString('en-US')}</b> {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-x" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <details className="chart-table">
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>{unit[0].toUpperCase() + unit.slice(1)}s</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>{p.value.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** A short ranked list: label, bar, value at the tip. */
export function BarList({
  rows,
  emptyText,
  stacked = false,
}: {
  rows: { label: string; value: number }[];
  emptyText: string;
  /** Long labels: each on its own line above its bar. */
  stacked?: boolean;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (max === 0) return <p className="admin-empty">{emptyText}</p>;
  return (
    <ul className={stacked ? 'bar-list is-stacked' : 'bar-list'}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-list-label">{r.label}</span>
          <span className="bar-list-track">
            <span className="bar-list-bar" style={vars({ '--w': `${(r.value / max) * 100}%` })} />
          </span>
          <span className="bar-list-value">{r.value.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  );
}

export type JourneyStep = { label: string; value: number; tag?: 'sample' | 'real'; note?: string };

/** Each step as a share of visitors, so drop-off reads at a glance. */
export function Journey({ steps, base }: { steps: JourneyStep[]; base: number }) {
  if (base === 0) return <p className="admin-empty">No visits in this period yet.</p>;
  return (
    <ol className="journey">
      {steps.map((s, i) => (
        <li key={s.label}>
          <span className="journey-n">{i + 1}</span>
          <span className="journey-label">
            {s.label}
            {s.tag && <Tag kind={s.tag} />}
            {s.note && <span className="journey-note">{s.note}</span>}
          </span>
          <span className="bar-list-track">
            <span className="bar-list-bar" style={vars({ '--w': `${Math.min(100, pct(s.value, base))}%` })} />
          </span>
          <span className="journey-value">
            <b>{s.value.toLocaleString('en-US')}</b> {pct(s.value, base)}%
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Counts by category, for the plan mix. */
export function MixCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="mix-card">
      <p className="mix-card-title">{title}</p>
      <dl>
        {rows.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

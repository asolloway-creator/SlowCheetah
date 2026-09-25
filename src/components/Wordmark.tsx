import Link from 'next/link';

/** The ring that stands in for the O: the same yellow marker the quota line uses for the accelerator. */
export function MarkRing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.3" fill="var(--sun)" stroke="var(--ink)" strokeWidth="3.6" />
    </svg>
  );
}

/**
 * "IOI" alone is an acronym, not a word, so the expansion sits beside it with
 * its own I/o/i picked out. `compact` drops the expansion (footer).
 */
export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="wordmark" aria-label="IOI, Information over incentive">
      <span className="wordmark-mark" aria-hidden="true">
        I<MarkRing className="wordmark-ring" />I
      </span>
      {!compact && (
        <span className="wordmark-full" aria-hidden="true">
          <b>I</b>nformation <b>o</b>ver <b>i</b>ncentive
        </span>
      )}
    </Link>
  );
}

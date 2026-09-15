import Link from 'next/link';

/**
 * The brand says its name once. The mark (post-ring-post) lives on the
 * favicon only — putting it beside the text here just repeated "IOI" twice.
 * "IOI" alone doesn't mean anything on first contact — it's an acronym, not
 * a word — so the expansion sits directly under it as one tight lockup, its
 * own I/O/I picked out, instead of floating beside it as an unrelated
 * caption. The letters have to visibly be the same letters.
 */
export default function Wordmark() {
  return (
    <Link href="/" className="wordmark">
      <span className="wordmark-mark">IOI</span>
      <span className="wordmark-full">
        <span className="wordmark-full-accent">I</span>nformation{' '}
        <span className="wordmark-full-accent">o</span>ver{' '}
        <span className="wordmark-full-accent">i</span>ncentive
      </span>
    </Link>
  );
}

import Link from 'next/link';

/**
 * The brand says its name once. The mark (post-ring-post) lives on the
 * favicon only — putting it beside the text here just repeated "IOI" twice.
 * The full name rides along in small italics — three letters alone don't
 * mean anything on first contact; this is the one place it's said without
 * costing a whole sentence of copy.
 */
export default function Wordmark() {
  return (
    <Link href="/" className="wordmark">
      <span className="wordmark-mark">IOI</span>
      <span className="wordmark-full">information over incentive</span>
    </Link>
  );
}

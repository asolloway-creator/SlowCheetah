import Link from 'next/link';

/**
 * The brand says its name once. The mark (post-ring-post) lives on the
 * favicon only — putting it beside the text here just repeated "IOI" twice.
 */
export default function Wordmark() {
  return (
    <Link href="/" className="wordmark">
      IOI
    </Link>
  );
}

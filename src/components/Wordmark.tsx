import Link from 'next/link';
import Mark from '@/components/Mark';

/** The brand says its name once. Used by the masthead on every route. */
export default function Wordmark() {
  return (
    <Link href="/" className="wordmark">
      <Mark />
      <span>IOI</span>
    </Link>
  );
}

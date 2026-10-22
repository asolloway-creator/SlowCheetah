import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

/** Full width on every page, whatever width the page's own content runs at. */
export default function Footer({ quiet = false }: { quiet?: boolean }) {
  return (
    <footer className={`footer${quiet ? ' is-quiet' : ''}`}>
      <div className="container">
        <div className="footer-inner">
          {!quiet && <Wordmark compact />}
          <div>
            {/* Signed in, the pitch has done its job: just the links. */}
            {!quiet && (
              <p>
                <b>IOI. Information over incentive.</b> A free tool for reps who want the whole number before they
                say it out loud.
              </p>
            )}
            <nav className="footer-links" aria-label="About IOI">
              <Link href="/plans-and-privacy">How IOI handles your plan</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Contact us</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

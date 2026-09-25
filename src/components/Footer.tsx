import Wordmark from '@/components/Wordmark';

/** Full width on every page, whatever width the page's own content runs at. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <Wordmark compact />
          <p>
            <b>IOI. Information over incentive.</b> A free tool for reps who want the whole number before they say it
            out loud.
          </p>
          <a className="footer-tell" href="mailto:asolloway@gmail.com?subject=IOI%3A%20my%20comp%20plan">
            Does this match your comp plan? Tell me &rarr;
          </a>
        </div>
      </div>
    </footer>
  );
}

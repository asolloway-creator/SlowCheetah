export default function Footer({ widthClass }: { widthClass: string }) {
  return (
    <footer className="footer">
      <div className={`container ${widthClass}`}>
        <p>
          IOI &mdash; information over incentive. A free tool for reps who want the whole number before they say it
          out loud.{' '}
          <a className="btn-text" href="mailto:asolloway@gmail.com?subject=IOI%20%E2%80%94%20my%20comp%20plan">
            Does this match your comp plan? Tell me &rarr;
          </a>
        </p>
        <p>Nothing you enter is shared. Signed-in data is private to your account.</p>
      </div>
    </footer>
  );
}

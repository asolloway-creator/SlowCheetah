/**
 * The mark is the diagram: post, ring, post — I O I. A line with a marker on
 * it, the same vocabulary as the number line on the stage.
 */
export default function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} width="30" height="14" viewBox="0 0 30 14" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="2" height="14" fill="currentColor" />
      <rect x="28" y="0" width="2" height="14" fill="currentColor" />
      <rect x="2" y="6.25" width="26" height="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="15" cy="7" r="4" fill="var(--stage, #FDFCF9)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

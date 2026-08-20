export default function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="bar-bg">
      <div
        className="bar-fill"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

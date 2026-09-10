'use client';

export default function Toggle({
  on,
  onChange,
  labelledBy,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      className="toggle"
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

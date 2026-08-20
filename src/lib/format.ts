const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar currency. */
export const fmt = (n: number) => usd0.format(n);
/** Cent-precision currency. */
export const fmtD = (n: number) => usd2.format(n);
/** One-decimal percentage. */
export const fmtP = (n: number) => `${n.toFixed(1)}%`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** The sidebar's icons: 20px, drawn in currentColor at one stroke weight. */
export type IconName = 'home' | 'deal' | 'forecast' | 'pipeline' | 'closed' | 'discounts' | 'plan' | 'plus' | 'menu' | 'close' | 'expand' | 'collapse' | 'search';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3.5 9 10 3.8 16.5 9v7.2H12v-4.4H8v4.4H3.5z" />,
  deal: (
    <>
      <path d="M3.5 10.3V4.2c0-.4.3-.7.7-.7h6.1l6.2 6.2-6.8 6.8z" />
      <circle cx="7.3" cy="7.3" r="1.3" />
    </>
  ),
  forecast: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3" />
      <path d="M10 10l4.6-4.6" />
    </>
  ),
  pipeline: <path d="M3 4h14l-5 6.2v5.3l-4 1.5v-6.8z" />,
  closed: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m7.2 10.2 2 2 3.8-4" />
    </>
  ),
  discounts: (
    <>
      <path d="m5.5 14.5 9-9" />
      <circle cx="6.3" cy="6.3" r="1.6" />
      <circle cx="13.7" cy="13.7" r="1.6" />
    </>
  ),
  plan: (
    <>
      <path d="M5 3.5h7l3 3v10H5z" />
      <path d="M8 9.5h4.5M8 12.5h4.5" />
    </>
  ),
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  expand: <path d="m8 5.5 4.5 4.5L8 14.5" />,
  collapse: <path d="M12 5.5 7.5 10l4.5 4.5" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5" />
      <path d="m12.8 12.8 3.7 3.7" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="as-icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

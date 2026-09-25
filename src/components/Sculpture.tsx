/**
 * Isometric quota-bar sculptures: a bar chart turned into an object. Pure
 * SVG built from a few numbers, so it renders on the server with no assets.
 * Decorative only.
 */

type Bar = { x: number; y: number; w: number; d: number; h: number };
type Stops3 = [string, string, string];
type Palette = { l: Stops3; r: Stops3; t: [string, string]; edge: string };

const PALETTES = {
  // On cream: lit faces cream to sunflower, shaded faces warm ink.
  sun: {
    l: ['#FFF3C4', '#FFD24A', '#F2B000'],
    r: ['#5A4C3A', '#342B21', '#1C1812'],
    t: ['#FFFDF4', '#FFE9A6'],
    edge: '#FFFFFF',
  },
  // On a sunflower panel: lit faces near white so they read against yellow.
  light: {
    l: ['#FFFFFF', '#FFF8E6', '#FFEBB0'],
    r: ['#4A3F31', '#2B241B', '#1C1812'],
    t: ['#FFFFFF', '#FFF6D8'],
    edge: '#FFFFFF',
  },
} satisfies Record<string, Palette>;

export type SculptureKind = 'chart' | 'cube' | 'cube-sm' | 'steps';

function rods(nx: number, ny: number, w: number, g: number, h: (i: number, j: number) => number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push({ x: i * (w + g), y: j * (w + g), w, d: w, h: h(i, j) });
  return out;
}

const SHAPES: Record<SculptureKind, { bars: Bar[]; unit: number }> = {
  // Rows rise toward the back, and the back row jumps: the accelerator.
  chart: { bars: rods(4, 5, 0.72, 0.18, (_i, j) => [5.9, 4.2, 3.5, 2.8, 2.2][j]), unit: 36 },
  cube: { bars: rods(4, 4, 0.76, 0.24, () => 3.9), unit: 40 },
  'cube-sm': { bars: rods(3, 3, 0.76, 0.24, () => 3.0), unit: 40 },
  steps: {
    bars: [5.4, 4.4, 3.6, 2.9, 2.3, 1.8].map((h, j) => ({ x: 0, y: j * 0.82, w: 3.2, d: 0.62, h })),
    unit: 34,
  },
};

const C = Math.cos(Math.PI / 6);
const ROUND = 4;
const pt = (p: [number, number]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const lerp = (p: [number, number], q: [number, number], t: number): [number, number] => [
  p[0] + (q[0] - p[0]) * t,
  p[1] + (q[1] - p[1]) * t,
];

type Face = { left: string; right: string; shineL: string; shineR: string; top: string; edge: string };

/** Projects every bar to its three visible faces, back to front, plus the bounding viewBox. */
function geometry(kind: SculptureKind): { faces: Face[]; viewBox: string } {
  const { bars, unit: u } = SHAPES[kind];
  const P = (x: number, y: number, z: number): [number, number] => [(x - y) * C * u, (x + y) * 0.5 * u - z * u];
  const sorted = [...bars].sort((a, b) => a.x + a.y + a.w / 2 + a.d / 2 - (b.x + b.y + b.w / 2 + b.d / 2));
  const all: [number, number][] = [];
  const faces = sorted.map((b) => {
    const x0 = b.x;
    const y0 = b.y;
    const x1 = b.x + b.w;
    const y1 = b.y + b.d;
    const h = b.h;
    const R = [P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, h), P(x1, y1, h)];
    const L = [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)];
    const T = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)];
    all.push(...R, ...L, ...T);
    const f0 = P(x1, y1, 0);
    const f1 = P(x1, y1, h);
    return {
      left: L.map(pt).join(' '),
      right: R.map(pt).join(' '),
      shineL: [lerp(f0, L[0], 0.34), f0, f1, lerp(f1, L[3], 0.34)].map(pt).join(' '),
      shineR: [f0, lerp(f0, R[1], 0.22), lerp(f1, R[2], 0.22), f1].map(pt).join(' '),
      top: T.map(pt).join(' '),
      edge: [P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)].map(pt).join(' '),
    };
  });
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const pad = ROUND + 2;
  const viewBox = [minX - pad, minY - pad, Math.max(...xs) - minX + pad * 2, Math.max(...ys) - minY + pad * 2]
    .map((v) => v.toFixed(1))
    .join(' ');
  return { faces, viewBox };
}

export default function Sculpture({
  kind,
  id,
  palette = 'sun',
  className,
}: {
  kind: SculptureKind;
  /** Unique per page: namespaces the gradient ids. */
  id: string;
  palette?: keyof typeof PALETTES;
  className?: string;
}) {
  const pal: Palette = PALETTES[palette];
  const { faces: geo, viewBox } = geometry(kind);
  const faces = geo.map((f, n) => (
    <g key={n}>
      <polygon points={f.left} fill={`url(#${id}l)`} stroke={`url(#${id}l)`} />
      <polygon points={f.right} fill={`url(#${id}r)`} stroke={`url(#${id}r)`} />
      <polygon points={f.shineL} fill={`url(#${id}sl)`} />
      <polygon points={f.shineR} fill={`url(#${id}sr)`} />
      <polygon points={f.top} fill={`url(#${id}t)`} stroke={`url(#${id}t)`} />
      <polyline points={f.edge} fill="none" stroke={pal.edge} strokeOpacity={0.75} strokeWidth={1.2} />
    </g>
  ));
  const g3 = (k: string, a: Stops3) => (
    <linearGradient id={`${id}${k}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={a[0]} />
      <stop offset=".55" stopColor={a[1]} />
      <stop offset="1" stopColor={a[2]} />
    </linearGradient>
  );

  return (
    <svg
      className={className}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      strokeLinejoin="round"
      strokeWidth={ROUND}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {g3('l', pal.l)}
        {g3('r', pal.r)}
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={pal.t[0]} />
          <stop offset="1" stopColor={pal.t[1]} />
        </linearGradient>
        <linearGradient id={`${id}sl`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}sr`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {faces}
    </svg>
  );
}

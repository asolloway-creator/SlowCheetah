import { notFound } from 'next/navigation';
import DevScreens from './DevScreens';

/**
 * Development only: the signed-in screens on fixture data, so they can be
 * looked at and tested without signing in. Not reachable in production.
 * /dev/home · /dev/home-new · /dev/plan · /dev/plan-new; ?v=deals (or forecast,
 * pipeline, closed, discounts) for a workspace view.
 */
const TABS = ['home', 'deals', 'forecast', 'pipeline', 'closed', 'discounts'] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DevPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { view } = await params;
  if (!['home', 'home-new', 'home-retro', 'home-crossed', 'home-recap', 'home-close', 'home-pipe', 'plan', 'plan-new'].includes(view)) notFound();
  const q = await searchParams;
  const v = one(q.v);
  const tab = TABS.find((t) => t === v) ?? 'home';
  return <DevScreens view={view} tab={tab} open={{ quote: one(q.quote), deal: one(q.deal), fresh: one(q.new) }} />;
}

import { notFound } from 'next/navigation';
import DevScreens from './DevScreens';

/**
 * Development only: the signed-in screens on fixture data, so they can be
 * looked at and tested without signing in. Not reachable in production.
 * /dev/home · /dev/home-new · /dev/plan · /dev/plan-new
 */
export default async function DevPage({ params }: { params: Promise<{ view: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { view } = await params;
  if (!['home', 'home-new', 'home-retro', 'home-crossed', 'home-recap', 'home-close', 'plan', 'plan-new'].includes(view)) notFound();
  return <DevScreens view={view} />;
}

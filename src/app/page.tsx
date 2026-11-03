import { currentUser } from '@/lib/queries';
import { DemoDeal } from './demo/DemoViews';
import Workspace from './workspace';

/** Signed out, the landing page and its sample deal; signed in, Home. */
export default async function Home() {
  const { user } = await currentUser();
  if (!user) return <DemoDeal />;
  return <Workspace view="home" />;
}

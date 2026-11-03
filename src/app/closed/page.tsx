import Workspace from '../workspace';

export const metadata = { title: 'Closed Won · IOI' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Workspace view="closed" search={await searchParams} />;
}

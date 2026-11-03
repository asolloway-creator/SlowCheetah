import Workspace from '../workspace';

export const metadata = { title: 'Pipeline · IOI' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Workspace view="pipeline" search={await searchParams} />;
}

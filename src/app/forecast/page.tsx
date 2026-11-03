import Workspace from '../workspace';

export const metadata = { title: 'Forecast · IOI' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Workspace view="forecast" search={await searchParams} />;
}

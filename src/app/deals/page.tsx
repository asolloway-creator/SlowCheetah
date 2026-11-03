import Workspace from '../workspace';

export const metadata = { title: 'Deal Desk · IOI' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Workspace view="deals" search={await searchParams} />;
}

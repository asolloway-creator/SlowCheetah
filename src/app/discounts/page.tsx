import Workspace from '../workspace';

export const metadata = { title: 'Discounts · IOI' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Workspace view="discounts" search={await searchParams} />;
}

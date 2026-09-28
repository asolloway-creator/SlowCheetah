import { Shell } from '@/app/AccountViews';
import { adminTimeZone, daysAgo, getAccounts, getTraffic, parseEnv, parseRange, requireAdmin, sinceOf } from '@/lib/admin';
import DashboardView from '@/components/admin/DashboardView';

export const metadata = { title: 'Dashboard · IOI', robots: { index: false, follow: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; emails?: string; env?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const env = parseEnv(sp.env);
  const since = sinceOf(range);
  const tz = await adminTimeZone();
  const [accounts, traffic] = await Promise.all([getAccounts(supabase), getTraffic(supabase, since, tz, env)]);

  return (
    <Shell current="/admin" email={user.email ?? ''} width="wide">
      <DashboardView
        accounts={accounts}
        traffic={traffic}
        range={range}
        env={env}
        showEmails={sp.emails === '1'}
        sinceMs={since.getTime()}
        weekAgo={daysAgo(7)}
        tz={tz}
      />
    </Shell>
  );
}

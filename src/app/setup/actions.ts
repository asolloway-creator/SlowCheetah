'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/queries';

export type SetupState = { error: string | null };

function num(fd: FormData, key: string) {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? n : NaN;
}

export async function saveCompPlan(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { supabase, user } = await requireUser();

  const role_name = String(formData.get('role_name') ?? '').trim();
  const fields = {
    quarterly_arr_quota: num(formData, 'quarterly_arr_quota'),
    commission_months: num(formData, 'commission_months'),
    accelerator_pct: num(formData, 'accelerator_pct'),
    software_mrr: num(formData, 'software_mrr'),
    freepour_mrr: num(formData, 'freepour_mrr'),
    bonus_launch: num(formData, 'bonus_launch'),
    bonus_boost: num(formData, 'bonus_boost'),
    bonus_accelerate: num(formData, 'bonus_accelerate'),
  };
  const accelerator_on_bonuses = formData.get('accelerator_on_bonuses') === 'true';

  if (!role_name) return { error: 'Role name is required.' };
  if (!(fields.quarterly_arr_quota > 0))
    return { error: 'Quarterly ARR quota must be greater than zero.' };
  for (const [key, v] of Object.entries(fields)) {
    if (!Number.isFinite(v) || v < 0)
      return { error: `${key.replaceAll('_', ' ')} must be zero or more.` };
  }

  const { error } = await supabase.from('comp_plans').upsert(
    { user_id: user.id, role_name, accelerator_on_bonuses, ...fields },
    { onConflict: 'user_id' },
  );

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/deal');
}

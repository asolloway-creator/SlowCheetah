'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/queries';

export type SetupState = { error: string | null };

function num(fd: FormData, key: string) {
  const raw = fd.get(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export async function saveCompPlan(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { supabase, user } = await requireUser();

  const role_name = String(formData.get('role_name') ?? '').trim();
  const monthly_unit_quota = num(formData, 'monthly_unit_quota');
  const base_rate = num(formData, 'base_rate');
  const accelerator_threshold = num(formData, 'accelerator_threshold');
  const accelerator_rate = num(formData, 'accelerator_rate');
  const arrRaw = String(formData.get('monthly_arr_quota') ?? '').trim();
  const monthly_arr_quota = arrRaw === '' ? null : Number(arrRaw);

  if (!role_name) return { error: 'Role name is required.' };
  if (!Number.isInteger(monthly_unit_quota) || monthly_unit_quota < 1)
    return { error: 'Monthly unit quota must be a whole number of at least 1.' };
  if (!Number.isInteger(accelerator_threshold) || accelerator_threshold < 1)
    return { error: 'Accelerator threshold must be a whole number of at least 1.' };
  if (!Number.isFinite(base_rate) || base_rate < 0 || base_rate > 100)
    return { error: 'Base rate must be a percentage between 0 and 100.' };
  if (!Number.isFinite(accelerator_rate) || accelerator_rate < 0 || accelerator_rate > 100)
    return { error: 'Accelerator rate must be a percentage between 0 and 100.' };
  if (monthly_arr_quota !== null && (!Number.isFinite(monthly_arr_quota) || monthly_arr_quota < 0))
    return { error: 'Monthly ARR quota must be a positive amount, or left blank.' };

  const { error } = await supabase.from('comp_plans').upsert(
    {
      user_id: user.id,
      role_name,
      monthly_unit_quota,
      base_rate,
      accelerator_threshold,
      accelerator_rate,
      monthly_arr_quota,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/deal');
}

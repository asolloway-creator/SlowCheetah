import type { PlanRecord } from './schema';

export type Correction = { path: string; from: unknown; to: unknown };

/**
 * Every value that differs between what the reader produced and what the
 * person confirmed: exactly where reading goes wrong, without keeping a word
 * anyone typed. Provenance fields are skipped; they describe the change.
 */
export function corrections(read: PlanRecord, confirmed: PlanRecord, limit = 60): Correction[] {
  const out: Correction[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (out.length >= limit) return;
    if (path.endsWith('.source')) return;
    const aObj = a !== null && typeof a === 'object';
    const bObj = b !== null && typeof b === 'object';
    if (aObj && bObj && Array.isArray(a) === Array.isArray(b)) {
      const keys = Array.isArray(a)
        ? Array.from({ length: Math.max((a as unknown[]).length, (b as unknown[]).length) }, (_, i) => String(i))
        : [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])];
      for (const k of keys) {
        walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      }
      return;
    }
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push({ path, from: a ?? null, to: b ?? null });
  };
  walk(read, confirmed, '');
  return out;
}

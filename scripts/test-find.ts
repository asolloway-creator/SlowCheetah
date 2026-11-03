// Find a deal (components/app/FindDeal.tsx findMatches), on invented names.
// Run: npx tsx scripts/test-find.ts
import { findMatches, type FindItem } from '@/components/app/FindDeal';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}
const it = (label: string, also?: string): FindItem => ({ key: label, label, sub: '', also, href: `/${label}` });
const items = [it('Juniper Hall Downtown', 'Juniper Hall'), it('Copper Pot'), it('Maple and Rye Fairfax', 'Maple and Rye'), it('The Pot Shop'), it('Blue Fern'), it('Saltwater', 'Harbor Group')];
const names = (q: string) => findMatches(items, q).map((m) => m.label).join(',');

check('nothing typed, nothing listed', findMatches(items, '  ').length === 0);
check('case does not matter', names('COPPER') === 'Copper Pot');
check('a name that starts with it comes first', names('blu') === 'Blue Fern' && names('ju').split(',')[0] === 'Juniper Hall Downtown');
check('words that start with it rank alike, then by name', names('pot') === 'Copper Pot,The Pot Shop', names('pot'));
check('a word inside the name matches', names('fairfax') === 'Maple and Rye Fairfax');
check('an account name finds its deals', names('harbor') === 'Saltwater');
check('no match, empty list', findMatches(items, 'zzz').length === 0);
check('never more than eight', findMatches(Array.from({ length: 20 }, (_, i) => it(`Deal ${i}`)), 'deal').length === 8);

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);

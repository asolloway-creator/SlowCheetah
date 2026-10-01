// Saves the key on the macOS clipboard into .env.local without printing it.
// Run from ioi-app/:  node scripts/key-from-clipboard.mjs
// Works out which key it is from its prefix, checks its length, and reports
// only the name and length.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../.env.local', import.meta.url);
const value = execFileSync('pbpaste', { encoding: 'utf8' }).replace(/\s+/g, '');

const KEYS = [
  { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', min: 80, max: 250 },
  { name: 'SUPABASE_SECRET_KEY', prefix: 'sb_secret_', min: 30, max: 120 },
];
const k = KEYS.find((x) => value.startsWith(x.prefix));
if (!k) {
  console.log(`The clipboard doesn't hold an Anthropic or Supabase secret key (${value.length} characters). Copy the key again and rerun.`);
  process.exit(1);
}
if (value.length < k.min || value.length > k.max) {
  console.log(`That ${k.name} is ${value.length} characters, which isn't a whole key. Copy it with the copy button and rerun.`);
  process.exit(1);
}
let env = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
const line = `${k.name}=${value}`;
const re = new RegExp(`^${k.name}=.*$`, 'm');
env = re.test(env) ? env.replace(re, line) : `${env.replace(/\n*$/, '\n')}${line}\n`;
writeFileSync(FILE, env, { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`Saved ${k.name} (${value.length} characters) to .env.local.`);

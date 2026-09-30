// Adds the two server-only keys to .env.local without echoing them anywhere.
// Run from ioi-app/:  node scripts/set-local-keys.mjs
// Paste each key when asked. Nothing is printed back, and .env.local is git-ignored.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

const FILE = new URL('../.env.local', import.meta.url);

const KEYS = [
  {
    name: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API key (console.anthropic.com, starts with sk-ant-)',
    ok: (v) => v.startsWith('sk-ant-'),
  },
  {
    name: 'SUPABASE_SECRET_KEY',
    label: 'Supabase secret key (Project Settings > API Keys, starts with sb_secret_)',
    ok: (v) => v.startsWith('sb_secret_') || v.startsWith('eyJ'),
  },
];

function askHidden(question) {
  return new Promise((resolve) => {
    // Everything readline echoes after the question (typed or pasted
    // characters, line redraws) goes to a stream that drops it.
    const out = new Writable({
      write(chunk, enc, cb) {
        if (!out.muted) process.stdout.write(chunk, enc);
        cb();
      },
    });
    out.muted = false;
    const rl = createInterface({ input: process.stdin, output: out, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    out.muted = true;
  });
}

let env = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
for (const k of KEYS) {
  const value = await askHidden(`${k.label}\nPaste it and press Enter (leave empty to skip): `);
  if (!value) {
    console.log(`Skipped ${k.name}.\n`);
    continue;
  }
  if (!k.ok(value)) {
    console.log(`That doesn't look like a ${k.name}. Skipped; run this again to retry.\n`);
    continue;
  }
  const line = `${k.name}=${value}`;
  const re = new RegExp(`^${k.name}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, line) : `${env.replace(/\n*$/, '\n')}${line}\n`;
  console.log(`Saved ${k.name}.\n`);
}
writeFileSync(FILE, env, { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log('Done. .env.local is updated and stays on this computer only.');

// One-time Web Push setup. Run from the repo root, with the Supabase CLI
// logged in and linked (npx supabase link --project-ref <ref>):
//
//   node supabase/functions/send-push/setup.mjs mailto:you@example.com
//
// It makes a fresh VAPID key pair and hook secret, stores the private parts
// straight into Edge Function secrets and Vault (they are never printed),
// deploys send-push, and prints only the PUBLIC key for the app's env
// (PUBLIC_VAPID_PUBLIC_KEY on Vercel). Running it again rotates the keys;
// devices subscribe again by themselves the next time the app opens.
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const subject = process.argv[2];
if (!/^mailto:\S+@\S+$/.test(subject ?? '')) {
	console.error('usage: node supabase/functions/send-push/setup.mjs mailto:you@example.com');
	process.exit(1);
}

const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const b64url = (buf) => Buffer.from(buf).toString('base64url');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const vapidPublic = b64url(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]));
const vapidPrivate = priv.d;
const hookSecret = b64url(randomBytes(32));

const supabase = (args, input) =>
	execFileSync('npx', ['supabase', ...args], { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'], input, shell: process.platform === 'win32' });

console.log('1/3 Edge Function secrets');
supabase(['secrets', 'set', `VAPID_PUBLIC_KEY=${vapidPublic}`, `VAPID_PRIVATE_KEY=${vapidPrivate}`, `VAPID_SUBJECT=${subject}`, `PUSH_HOOK_SECRET=${hookSecret}`]);

console.log('2/3 Vault secrets for the database trigger');
const sql = `do $$ declare v_id uuid; begin
	select id into v_id from vault.secrets where name = 'push_hook_url';
	if v_id is null then perform vault.create_secret('https://${ref}.supabase.co/functions/v1/send-push', 'push_hook_url');
	else perform vault.update_secret(v_id, 'https://${ref}.supabase.co/functions/v1/send-push'); end if;
	select id into v_id from vault.secrets where name = 'push_hook_secret';
	if v_id is null then perform vault.create_secret('${hookSecret}', 'push_hook_secret');
	else perform vault.update_secret(v_id, '${hookSecret}'); end if;
end $$;`;
// Through a file: Windows' shell mangles "$$" and newlines in an argument.
// It holds the hook secret, so it lives only for this one call.
const sqlFile = join(mkdtempSync(join(tmpdir(), 'goose-push-')), 'vault.sql');
writeFileSync(sqlFile, sql, { mode: 0o600 });
try {
	supabase(['db', 'query', '--linked', '-f', sqlFile]);
} finally {
	rmSync(dirname(sqlFile), { recursive: true, force: true });
}

console.log('3/3 Deploying send-push');
supabase(['functions', 'deploy', 'send-push', '--no-verify-jwt']);

console.log('\nDone. Set this on Vercel (Production + Preview), then redeploy the app:');
console.log(`PUBLIC_VAPID_PUBLIC_KEY=${vapidPublic}`);

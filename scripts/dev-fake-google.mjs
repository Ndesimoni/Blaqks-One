// `npm run dev:google`: the loopback Google stand-in for trying mailboxes locally before
// the real Google app exists (docs/google-mail-setup.md). It reads the local .env, runs
// only when CRM_GOOGLE_ENDPOINT points here, and never contacts Google or sends email.
import { readFileSync } from 'node:fs';
import { startFakeGoogle } from './fake-google.mjs';

const values = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const endpoint = values.CRM_GOOGLE_ENDPOINT ?? '';
const port = Number(new URL(endpoint || 'http://invalid').port);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint) || !port) {
  throw Error('Set CRM_GOOGLE_ENDPOINT=http://127.0.0.1:8791 in .env for local mailbox trials.');
}
for (const name of ['CRM_GOOGLE_CLIENT_ID', 'CRM_GOOGLE_CLIENT_SECRET', 'CRM_APP_ORIGIN']) {
  if (!values[name]) throw Error(`Set ${name} in .env (see docs/google-mail-setup.md).`);
}
await startFakeGoogle({
  port,
  clientId: values.CRM_GOOGLE_CLIENT_ID,
  clientSecret: values.CRM_GOOGLE_CLIENT_SECRET,
  redirectUri: `${values.CRM_APP_ORIGIN}/api/crm/integrations/google/callback`,
});
console.log(`Pretend Google is running on ${endpoint}. No real email is sent.`);

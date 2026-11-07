// `npm run dev:sendgrid`: the loopback SendGrid stand-in for trying company email locally
// before the real SendGrid account exists (docs/sendgrid-design.md). It reads the local
// .env, runs only when CRM_SENDGRID_ENDPOINT points here, and never contacts SendGrid.
import { readFileSync } from 'node:fs';
import { startFakeSendgrid } from './fake-sendgrid.mjs';

const line = readFileSync('.env', 'utf8')
  .split('\n')
  .map((text) => text.trim())
  .find((text) => text.startsWith('CRM_SENDGRID_ENDPOINT='));
const endpoint = line?.slice('CRM_SENDGRID_ENDPOINT='.length) ?? '';
const port = Number(new URL(endpoint || 'http://invalid').port);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint) || !port) {
  throw Error('Set CRM_SENDGRID_ENDPOINT=http://127.0.0.1:8793 in .env for local email trials.');
}
await startFakeSendgrid({ port });
console.log(`Pretend SendGrid is running on ${endpoint}. No real email is sent.`);
console.log('Connect with the key SG.ok.<your domain>, for example SG.ok.keyswithsimoni.com.');

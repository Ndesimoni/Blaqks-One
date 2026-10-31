// `npm run dev:twilio`: the loopback Twilio stand-in for trying WhatsApp locally before the
// real Twilio account is connected (docs/whatsapp-design.md §9). It reads the local .env,
// runs only when CRM_TWILIO_ENDPOINT points at a loopback port, and never contacts Twilio.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { startFakeTwilio } from './fake-twilio.mjs';

const line = readFileSync('.env', 'utf8')
  .split('\n')
  .map((text) => text.trim())
  .find((text) => text.startsWith('CRM_TWILIO_ENDPOINT='));
const endpoint = line?.slice('CRM_TWILIO_ENDPOINT='.length) ?? '';
const port = Number(new URL(endpoint || 'http://invalid').port);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint) || !port) {
  throw Error('Set CRM_TWILIO_ENDPOINT=http://127.0.0.1:8794 in .env for local WhatsApp trials.');
}
await startFakeTwilio({ port });
console.log(`Pretend Twilio is running on ${endpoint}. No real WhatsApp message is sent.`);
console.log(`Connect with any Account SID and Auth Token of the right shape, for example:`);
console.log(`  Account SID AC${randomBytes(16).toString('hex')}`);
console.log(`  Auth Token  ${randomBytes(16).toString('hex')}`);
console.log('Each account lists four synthetic +999 senders; the last one is OFFLINE.');

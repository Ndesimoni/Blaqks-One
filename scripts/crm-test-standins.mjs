// The provider stand-ins for one isolated test run (see test-crm-api.mjs): Google,
// SendGrid and Twilio on loopback ports. Every port must be free first, so a suite can
// never reach another run's servers, and the API must point only at loopback stand-ins.
import { FAKE_GOOGLE_PORT, FAKE_SENDGRID_PORT, FAKE_TWILIO_PORT } from './crm-test-env.mjs';
import { ensurePortFree } from './crm-test-processes.mjs';
import { startFakeGoogle } from './fake-google.mjs';
import { startFakeSendgrid } from './fake-sendgrid.mjs';
import { startFakeTwilio } from './fake-twilio.mjs';

const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d+$/;

export async function startStandins(env) {
  for (const name of ['CRM_SENDGRID_ENDPOINT', 'CRM_TWILIO_ENDPOINT', 'CRM_GOOGLE_ENDPOINT']) {
    if (!LOOPBACK.test(env[name] ?? '')) throw Error(`${name} must be a loopback stand-in.`);
  }
  for (const port of [8790, FAKE_GOOGLE_PORT, FAKE_SENDGRID_PORT, FAKE_TWILIO_PORT]) {
    await ensurePortFree('127.0.0.1', port);
  }
  const started = [];
  const close = () => Promise.all(started.map((server) => server.close()));
  try {
    started.push(await startFakeSendgrid({ port: FAKE_SENDGRID_PORT }));
    started.push(await startFakeTwilio({ port: FAKE_TWILIO_PORT }));
    started.push(
      await startFakeGoogle({
        port: FAKE_GOOGLE_PORT,
        clientId: env.CRM_GOOGLE_CLIENT_ID,
        clientSecret: env.CRM_GOOGLE_CLIENT_SECRET,
        redirectUri: `${env.CRM_APP_ORIGIN}/api/crm/integrations/google/callback`,
      }),
    );
  } catch (error) {
    await close();
    throw error;
  }
  return { close };
}

import { spawn } from 'node:child_process';
import { stop, waitForApi } from './crm-test-processes.mjs';

export async function checkSignupOff(binary, env) {
  const server = spawn(binary, [], {
    env: { ...env, CRM_SIGNUP: 'off' },
    stdio: 'inherit',
  });
  try {
    await waitForApi(`${env.CRM_TEST_API}/health`, server);
    const headers = { Origin: env.CRM_APP_ORIGIN };
    const status = await fetch(`${env.CRM_TEST_API}/signup/status`, { headers });
    const statusBody = await status.json();
    if (status.status !== 200 || statusBody.enabled !== false || statusBody.mode !== 'off') {
      throw Error('Disabled sign-up status contract failed.');
    }
    const start = await fetch(`${env.CRM_TEST_API}/signup/start`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const startBody = await start.json();
    if (start.status !== 404 || startBody.code !== 'not_found') {
      throw Error('Disabled sign-up mutation route was reachable.');
    }
  } finally {
    await stop(server);
  }
}

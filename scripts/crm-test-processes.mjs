import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';

export function run(command, args, env, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(output.trim());
      else reject(Error(`${command} exited with ${code}.${capture ? ` ${output}` : ''}`));
    });
  });
}

/** Fails fast when another server already holds the port, so tests never reach it. */
export function ensurePortFree(host, port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(Error(`Port ${port} is already in use; another CRM test run may be active.`)),
    );
    probe.listen(port, host, () => probe.close(resolve));
  });
}

export async function waitForApi(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw Error('CRM API stopped before it was ready.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The listener or migration may still be starting.
    }
    await setTimeout(200);
  }
  throw Error('CRM API did not become ready within 20 seconds.');
}

export async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const closed = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([closed, setTimeout(5000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await closed;
  }
}

/**
 * The messaging worker for the suites: sends queued email, reads replies, retries
 * revocations and sweeps media through the stand-ins. Webhook intake stays off so suites
 * can inspect staged events.
 */
export function startWorker(binary, env) {
  return spawn(binary.replace('kws-crm-api', 'messaging_worker'), [], {
    env: {
      ...env,
      CRM_WORKER_LOOPS: 'outbox,revocations,mailsync,mediasweep',
      CRM_MAIL_SYNC_SECONDS: '1',
      CRM_MEDIA_SWEEP_SECONDS: '2',
    },
    stdio: 'inherit',
  });
}

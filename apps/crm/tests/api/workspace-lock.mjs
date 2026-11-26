import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { query } from './helpers.mjs';

export async function holdWorkspaceLock(workspace) {
  const project = process.env.CRM_TEST_PROJECT;
  assert.match(project, /^kws-crm-test-[a-f0-9]+$/);
  assert.match(workspace, /^[a-f0-9-]{36}$/);
  const child = spawn(
    'docker',
    [
      'compose',
      '-f',
      'compose.test.yaml',
      '-p',
      project,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'kws_crm_test',
      '-d',
      'kws_crm_test',
      '-qAtX',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let output = '';
  let diagnostics = '';
  child.stderr.on('data', (chunk) => {
    diagnostics += chunk;
  });
  const ended = new Promise((resolve) => child.once('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Test lock could not be acquired.')), 10000);
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (output.includes('LOCK_READY')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', () => {
        clearTimeout(timeout);
        reject(Error(diagnostics));
      });
      child.stdin.write(
        `BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('${workspace}',0));\n\\echo LOCK_READY\n`,
      );
    });
  } catch (error) {
    child.kill();
    throw error;
  }
  return async () => {
    child.stdin.end('COMMIT;\n\\q\n');
    assert.equal(await ended, 0, diagnostics);
  };
}

export async function waitForWorkspaceQueue(count) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (Number(query("SELECT count(*) FROM pg_stat_activity WHERE wait_event='advisory'")) >= count)
      return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw Error(`Expected ${count} queued workspace mutations.`);
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { query } from './helpers.mjs';

/** Locks only the disposable ledger; the caller can commit a payment before releasing GET. */
export async function holdPaymentTable() {
  const project = process.env.CRM_TEST_PROJECT;
  assert.match(project, /^kws-crm-test-[a-f0-9]+$/);
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
      const timeout = setTimeout(() => reject(Error('Payment table lock timed out.')), 10000);
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (output.includes('PAYMENTS_LOCK_READY')) {
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
        'BEGIN; LOCK TABLE agreements.crm_agreement_payments IN ACCESS EXCLUSIVE MODE;\n\\echo PAYMENTS_LOCK_READY\n',
      );
    });
  } catch (error) {
    child.kill();
    throw error;
  }
  let released = false;
  return async (sql) => {
    if (released) return;
    released = true;
    child.stdin.end(sql ? `${sql}\nCOMMIT;\n\\q\n` : 'ROLLBACK;\n\\q\n');
    assert.equal(await ended, 0, diagnostics);
  };
}

/** Confirms GET reached its entries query after its agreement snapshot was acquired. */
export async function waitForPaymentRead() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = query(`SELECT count(*) FROM pg_stat_activity a JOIN pg_locks l
      ON l.pid=a.pid WHERE a.wait_event='relation' AND NOT l.granted
      AND l.relation='agreements.crm_agreement_payments'::regclass
      AND a.query LIKE '%jsonb_build_object(''id'',id,''action'',action%'
      AND a.query NOT LIKE '%pg_stat_activity%'`);
    if (Number(waiting) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw Error('Payment GET did not block at its ledger entries query.');
}

/** The trusted `media-backfill` command and record checks for its suite (F2 backfill). */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { api, query } from './helpers.mjs';

const binary = resolve('services/crm-api/target/debug/kws-crm-api');

/**
 * Runs the command against the disposable test database, with optional environment
 * overrides, and parses its JSON-lines report: a header, then one line per workspace.
 */
export function backfillWith(env, ...args) {
  assert.ok(process.env.CRM_TEST_PROJECT?.startsWith('kws-crm-test-'));
  const result = spawnSync(binary, ['media-backfill', ...args], {
    env: { ...process.env, ...env },
    input: '',
    encoding: 'utf8',
  });
  const lines = result.stdout.split('\n').filter((line) => line.startsWith('{'));
  const [header, ...workspaces] = lines.map((line) => JSON.parse(line));
  const report = header ? { ...header, workspaces } : null;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, report };
}

export const backfill = (...args) => backfillWith({}, ...args);

export const dataUrl = (mime, bytes) => `data:${mime};base64,${bytes.toString('base64')}`;

/** Each record's ID, version and payload fingerprint, to prove nothing else changed. */
export const snapshot = (ids) =>
  query(
    `SELECT string_agg(id||':'||version||':'||md5(payload::text), ',' ORDER BY id)
     FROM crm_records WHERE id IN (${ids.map((id) => `'${id}'`).join(',')})`,
  );

export const payload = (id) =>
  JSON.parse(query(`SELECT payload FROM crm_records WHERE id='${id}'`));

export const version = (id) => Number(query(`SELECT version FROM crm_records WHERE id='${id}'`));

export const movedFiles = (workspace) =>
  Number(
    query(
      `SELECT count(*) FROM media.crm_media_objects
       WHERE workspace_id='${workspace}' AND origin='backfill' AND deleted_at IS NULL`,
    ),
  );

/** Every file row of the workspace in any state, and the hidden backfill ones. */
const countFiles = (workspace, where) =>
  Number(
    query(
      `SELECT count(*) FROM media.crm_media_objects WHERE workspace_id='${workspace}' ${where}`,
    ),
  );
export const allFiles = (workspace) => countFiles(workspace, '');
export const hiddenFiles = (workspace) =>
  countFiles(workspace, "AND origin='backfill' AND deleted_at IS NOT NULL");

/** The workspace's report, which must exist. */
export function workspaceReport(report, workspace) {
  const found = report.workspaces.find((item) => item.workspace === workspace);
  assert.ok(found, `the report covers ${workspace}`);
  return found;
}

/** Downloads a record's stored file through the record file route. */
export async function recordFile(session, workspace, id, file) {
  const path = `/workspaces/${workspace}/records/Properties/${id}/files/${file}`;
  const response = await fetch(`${api}${path}`, { headers: { Cookie: session.cookie } });
  return {
    status: response.status,
    headers: response.headers,
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

/** Gives the record an inline photo over the 10 MB limit, built inside PostgreSQL. */
export function giveOversizedPhoto(id) {
  query(
    `UPDATE crm_records SET payload=jsonb_set(payload,'{media_photos}',jsonb_build_array(
       jsonb_build_object('name','Huge synthetic photo','src','data:image/jpeg;base64,'||
         encode(decode('ffd8ff','hex')||convert_to(repeat('A',10485761),'UTF8'),'base64'))))
     WHERE id='${id}'`,
  );
}

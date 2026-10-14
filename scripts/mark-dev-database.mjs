/**
 * `npm run db:mark-dev`: marks the local Docker compose PostgreSQL database as a local
 * development database, so the sample-data commands may write to it. It runs inside the
 * compose `postgres` container (`docker compose exec`), so it cannot reach a hosted or
 * tunnelled database. New local volumes are marked by the compose init script already.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const markerSql = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  'services/crm-api/dev/local-development.sql',
);

/** `compose` selects the project, for example ['compose', '-f', 'compose.test.yaml', ...]. */
export function markDatabase(compose = ['compose'], env = process.env) {
  execFileSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -',
    ],
    { env, input: readFileSync(markerSql, 'utf8'), stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    markDatabase();
    console.log('The local Docker CRM database is marked for sample data.');
  } catch {
    console.error('Could not mark the local database. Start it first with npm run db:up.');
    process.exitCode = 1;
  }
}

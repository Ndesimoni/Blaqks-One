import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(new URL('../.env', import.meta.url));
const password = randomBytes(32).toString('hex');
const contents = [
  '# Private local development configuration; never commit this file.',
  `CRM_POSTGRES_PASSWORD=${password}`,
  'CRM_POSTGRES_PORT=55432',
  `CRM_DATABASE_URL=postgres://kws_crm:${password}@127.0.0.1:55432/kws_crm`,
  'CRM_APP_ORIGIN=http://localhost:5173',
  'CRM_BIND_ADDRESS=127.0.0.1:8788',
  'CRM_ALLOW_INSECURE_LOCAL=true',
  `CRM_MESSAGING_KEY=${randomBytes(32).toString('base64')}`,
  'CRM_MESSAGING_KEY_VERSION=1',
  // Private file storage in Docker (docs/media-storage.md).
  'CRM_MEDIA_ENDPOINT=http://127.0.0.1:58333',
  'CRM_MEDIA_BUCKET=crm-media',
  `CRM_MEDIA_ACCESS_KEY=crm${randomBytes(6).toString('hex')}`,
  `CRM_MEDIA_SECRET_KEY=${randomBytes(24).toString('hex')}`,
  'VITE_CRM_MODE=server',
  'CRM_API_PROXY=http://127.0.0.1:8788',
  '',
].join('\n');

try {
  await writeFile(destination, contents, { flag: 'wx', mode: 0o600 });
  console.log('Created private .env with a random PostgreSQL password.');
  console.log('Start PostgreSQL with npm run db:up. Existing demo data is unchanged.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.log('.env already exists; no configuration was changed.');
  } else {
    console.error('Could not create the local configuration. Check folder permissions.');
    process.exitCode = 1;
  }
}

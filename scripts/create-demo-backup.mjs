import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SEED_CRM } from '../apps/crm/src/data/demo.js';
import { attachDemoListingPhotos } from '../apps/crm/src/lib/demoPropertyPhotos.js';
import { createFullBackup, parseFullBackup } from '../apps/crm/src/services/files/backup.js';

const data = await attachDemoListingPhotos(SEED_CRM(), async (sample) => ({
  name: `${sample.name}.jpg`,
  type: 'image/jpeg',
  src: `data:image/jpeg;base64,${(await readFile(`public${sample.src}`)).toString('base64')}`,
  demo: true,
  source: 'generated-demo',
}));
const backup = { ...createFullBackup(data), demo: true };
const json = JSON.stringify(backup, null, 2);
parseFullBackup(json);
await mkdir('apps/crm/public/demo', { recursive: true });
const path = 'apps/crm/public/demo/demo-workspace-backup.json';
await writeFile(path, `${json}\n`);
console.log(`Created ${path} with fictional records and labelled demo photos.`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let failed = false;
async function visit(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/\.(?:js|mjs|css|html|json)$/.test(entry.name)) {
      const content = await fs.readFile(file, 'utf8');
      const count = content.trimEnd().split('\n').length;
      if (count > 150) {
        console.error(path.relative(root, file) + ': ' + count + ' lines');
        failed = true;
      }
    }
  }
}
await visit(root);
if (failed) process.exitCode = 1;
else console.log('All reconstruction code files are within 150 lines.');

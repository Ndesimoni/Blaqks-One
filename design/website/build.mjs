import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = await readFile(`${root}styles.css`, 'utf8');
const sheets = [...manifest.matchAll(/@import '(.+)';/g)].map((m) => m[1]);
const css = (await Promise.all(sheets.map((p) => readFile(`${root}${p}`, 'utf8')))).join('\n');
const result = await build({
  entryPoints: [`${root}app.js`],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2022',
});
let javascript = result.outputFiles[0].text;
for (const name of ['villa-exterior', 'apartment-interior', 'commercial-office']) {
  const bytes = await readFile(`${root}assets/${name}.jpg`);
  javascript = javascript.replaceAll(
    `assets/${name}.jpg`,
    `data:image/jpeg;base64,${bytes.toString('base64')}`,
  );
}
const source = await readFile(`${root}index.html`, 'utf8');
const html = source
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>${css}</style>`)
  .replace(
    '<script type="module" src="app.js"></script>',
    `<script>${javascript.replaceAll('</script', '<\\/script')}</script>`,
  );
await mkdir(`${root}dist`, { recursive: true });
await writeFile(`${root}dist/review.html`, html);
console.log(
  `Created standalone design/website/dist/review.html (${Math.round(Buffer.byteLength(html) / 1024)} KB).`,
);

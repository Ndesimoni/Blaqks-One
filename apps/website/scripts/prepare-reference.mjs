import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, transform } from 'esbuild';
import postcss from 'postcss';
import { patchReference } from './reference-patches.mjs';
import { referenceSnapshots } from './reference-snapshots.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'blaqks-approved-'));
const root = path.join(temporary, 'dist');
const output = path.join(app, 'public/approved');
try {
  execFileSync('tar', [
    '-xzf',
    path.join(app, 'reference/approved-source.tar.gz'),
    '-C',
    temporary,
  ]);
  const { homes } = await import(pathToFileURL(root + '/estate.js'));
  const { people } = await import(pathToFileURL(root + '/agent-components.js'));
  const { companies } = await import(pathToFileURL(root + '/public-pages.js'));
  const { dealData } = await import(pathToFileURL(root + '/deal-data.js'));
  const fixtures = { homes, people, companies, dealData };
  await fs.mkdir(path.join(app, 'src/generated'), { recursive: true });
  await fs.writeFile(path.join(app, 'src/generated/approved.json'), JSON.stringify(fixtures));
  await fs.writeFile(
    path.join(app, 'src/generated/approved-pages.json'),
    JSON.stringify(await referenceSnapshots(root)),
  );
  await fs.mkdir(output, { recursive: true });
  await fs.cp(root + '/assets', output + '/assets', { recursive: true });
  const files = [
    'base',
    'auth',
    'components',
    'landing',
    'responsive',
    'estate',
    'property',
    'properties',
    'site-header',
    'public-pages',
    'deals',
    'readability',
  ];
  let styles = '';
  for (const name of files) {
    const css = postcss.parse(await fs.readFile(root + '/' + name + '.css', 'utf8'));
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      rule.selectors = rule.selectors.map((selector) => {
        const prefix = "body[data-site-kind='platform']";
        if (/^(:root|html)(?=[\s.#[:]|$)/.test(selector))
          return selector.replace(/^(:root|html)/, prefix);
        if (/^body(?=[\s.#[:]|$)/.test(selector)) return selector.replace(/^body/, prefix);
        // `.estate-page` is a class on <body> itself, so it joins the prefix without a space.
        if (/^\.estate-page(?=[\s.#[:]|$)/.test(selector)) return prefix + selector;
        return prefix + ' ' + selector;
      });
    });
    styles += css.toString().replaceAll('assets/', '/approved/assets/') + '\n';
  }
  for (const name of ['native', 'polish', 'contrast', 'directory', 'motion', 'motion-hover'])
    styles += await fs.readFile(path.join(app, `scripts/reference-${name}.css`), 'utf8');
  const css = await transform(styles, { loader: 'css', minify: true });
  await fs.writeFile(
    output + '/reference.css',
    '/* Generated from approved-source.tar.gz. */\n' + css.code,
  );
  const imports = await fs.readFile(path.join(app, 'src/styles/index.css'), 'utf8');
  let companyStyles = '';
  for (const match of imports.matchAll(/@import ['"]\.\/([^'"]+)['"]/g)) {
    if (!match[1].startsWith('homeverse-'))
      companyStyles += await fs.readFile(path.join(app, 'src/styles', match[1]), 'utf8');
  }
  const inherited = companyStyles.match(/body\[data-site-kind='company'\]\[data-theme='1'\]/g);
  if (!inherited?.length) throw Error('Company theme foundation is missing.');
  let innerStyles = '';
  for (const match of imports.matchAll(/@import ['"]\.\/([^'"]+)['"]/g)) {
    if (match[1].startsWith('atelier-'))
      innerStyles += (await fs.readFile(path.join(app, 'src/styles', match[1]), 'utf8')).replaceAll(
        "[data-theme='1']",
        "[data-theme='2']",
      );
  }
  const homeverseImports = [...imports.matchAll(/@import ['"]\.\/(homeverse-[^'"]+)['"]/g)];
  for (const match of homeverseImports)
    innerStyles += await fs.readFile(path.join(app, 'src/styles', match[1]), 'utf8');
  companyStyles += innerStyles;
  await fs.writeFile(
    output + '/company.css',
    (await transform(companyStyles, { loader: 'css', minify: true })).code,
  );
  await patchReference(root);
  const modules = ['runtime', 'binding', 'after-render', 'extra', 'directory', 'profile', 'motion'];
  for (const name of [...modules, 'developers', 'live-text', 'pagination', 'public-details'])
    await fs.copyFile(
      path.join(app, `scripts/reference-${name}.mjs`),
      `${root}/reference-${name}.js`,
    );
  await fs.copyFile(
    path.join(app, 'src/lib/reference/identity.ts'),
    root + '/reference-identity.ts',
  );
  // The scroll reveal is shared with the company websites.
  await fs.cp(path.join(app, 'src/lib/motion'), root + '/motion', { recursive: true });
  await build({
    entryPoints: [root + '/reference-runtime.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: output + '/runtime.js',
    minify: true,
    legalComments: 'none',
    banner: { js: '/* Generated from the recovered approved design and the Next.js adapter. */' },
  });
  console.log('Prepared the recovered approved design, all pictures and scoped styles.');
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

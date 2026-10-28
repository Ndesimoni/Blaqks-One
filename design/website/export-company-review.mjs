import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { companyReviewPages } from './company-review-pages.js';
import { esc, url } from './helpers.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = 'http://127.0.0.1:4178/';
const frames = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [index, [title, path, params]] of companyReviewPages.entries()) {
    const frame = { title, images: {} };
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}?capture=${index}-${width}${url(path, { site: 'harbour', theme: '1', ...params })}`,
      );
      await expect(page.locator('body')).toHaveAttribute('data-page', path);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      const bytes = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: true,
        style: '.review-bar { display: none; }',
      });
      frame.images[width] = `data:image/jpeg;base64,${bytes.toString('base64')}`;
    }
    frames.push(frame);
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}

const choices = frames
  .map((frame, index) => `<option value="${index}">${index + 1}. ${esc(frame.title)}</option>`)
  .join('');
const galleryCss = await readFile(`${root}review-gallery.css`, 'utf8');
const galleryScript = await readFile(`${root}review-viewer.js`, 'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All company website pages · Blaqks One</title>
<style>${galleryCss}</style></head><body><header><h1>The complete company website.</h1><p>${frames.length} pages and visual states, each shown from top to bottom. Choose a page, then switch between desktop and mobile. These are design screenshots with fictional content; forms, legal text and unavailable states are demonstrations.</p><div class="controls"><label>Page<select id="page" aria-label="Page">${choices}</select></label><button id="desktop" aria-pressed="true">Desktop</button><button id="mobile" aria-pressed="false">Mobile</button><button id="previous">← Previous</button><button id="next">Next →</button><p id="status" role="status"></p></div></header><main><figure><figcaption id="title"></figcaption><img id="preview" alt=""></figure><noscript>Enable JavaScript to choose a page in this visual review.</noscript></main>
<script type="application/json" id="review-frames">${JSON.stringify(frames)}</script><script>${galleryScript}</script></body></html>`;
await mkdir(`${root}dist`, { recursive: true });
await writeFile(`${root}dist/company-all-pages.html`, html);
console.log(
  `Exported ${frames.length} pages × 2 sizes: company-all-pages.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB).`,
);

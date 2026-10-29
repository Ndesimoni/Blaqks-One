import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { ensurePortFree, stop } from '../../scripts/crm-test-processes.mjs';
import { ok, property, publish, put, setup, websitePath } from './website-helpers.mjs';

test('Next.js uses the real public API, renders public media/CMS updates, and saves an enquiry in the CRM', async () => {
  await ensurePortFree('127.0.0.1', 3002);
  const t = await setup('next');
  const bytes = await readFile('design/website/assets/villa-exterior.jpg');
  const listing = ok(
    await publish(t.admin, await property(t.admin, {}, bytes), t.profile),
  ).publication;
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3002'],
    {
      cwd: 'apps/website',
      env: {
        ...process.env,
        WEBSITE_DATA_MODE: 'api',
        WEBSITE_API_ORIGIN: process.env.CRM_TEST_API.replace('/api/crm', ''),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  server.stdout.on('data', (chunk) => {
    output = (output + chunk).slice(-4000);
  });
  server.stderr.on('data', (chunk) => {
    output = (output + chunk).slice(-4000);
  });
  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) throw Error(`Next server stopped: ${output}`);
      try {
        await fetch('http://127.0.0.1:3002/robots.txt');
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 1000 },
      reducedMotion: 'reduce',
    });
    const origin = `http://${t.a.host}:3002`;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/www.openstreetmap.org/**', (route) => route.abort());
    await page.goto(`${origin}/properties/${listing.id}`);
    await expect(page.locator('main h1')).toContainText('Public home');
    const image = page.locator('.gallery-cover img');
    await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
    assert.match(await image.getAttribute('src'), /\/api\/public\/v1\/sites\/.+\/media\//);
    await page.getByRole('link', { name: /Ask agent for exact location/ }).click();
    await expect(page.getByRole('heading', { name: 'A conversation starts here.' })).toBeVisible();
    await mkdir('apps/website/screenshots', { recursive: true });
    await page.screenshot({
      path: 'apps/website/screenshots/connected-enquiry-mobile.png',
      fullPage: true,
    });
    await page.getByLabel('Your name', { exact: true }).fill('Synthetic connected visitor');
    await page.getByLabel('Email', { exact: true }).fill(`next-${randomUUID()}@visitor.test`);
    await page
      .getByLabel('Your message', { exact: true })
      .fill('Connected browser enquiry, synthetic only.');
    await page.locator('input[name="privacy"]').check();
    await page.getByRole('button', { name: 'Send enquiry →', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Your enquiry has been received.' }),
    ).toBeVisible();
    const enquiries = ok(await t.admin.request(websitePath(t.admin, '/enquiries'))).data;
    assert.ok(enquiries.some((e) => e.enquiry.name === 'Synthetic connected visitor'));
    const site = ok(await t.admin.request(websitePath(t.admin))).site;
    const draft = ok(
      await put(t.admin, websitePath(t.admin, '/draft'), {
        version: 0,
        site: {
          version: site.version,
          name: site.name,
          theme: '4',
          content: {
            heroTitle: 'Changed through the CRM backend',
            seoTitle: 'Published company search title',
            seoDescription: 'Published company search description.',
            services: 'Synthetic property advice.\nSynthetic relocation support.',
          },
          company: { mark: 'WC', area: 'Dubai', note: 'Public note' },
        },
      }),
    ).draft;
    await page.goto(origin);
    await expect(page.locator('main h1')).not.toHaveText('Changed through the CRM backend');
    ok(
      await t.admin.request(websitePath(t.admin, '/publish'), {
        method: 'POST',
        body: { version: draft.version },
      }),
    );
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Changed through the CRM backend');
    await expect(page).toHaveTitle(/Published company search title/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Published company search description.',
    );
    await page.goto(`${origin}/about`);
    await expect(page.getByRole('heading', { name: 'Our services.', exact: true })).toBeVisible();
    await expect(
      page.getByText('Synthetic property advice. Synthetic relocation support.', { exact: true }),
    ).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({
      path: 'apps/website/screenshots/connected-published-home-mobile.png',
      fullPage: true,
    });
    const crossOrigin = await page.request.post('http://127.0.0.1:3002/api/enquiries', {
      headers: {
        Host: `${t.a.host}:3002`,
        Origin: 'http://evil.example',
        'Idempotency-Key': randomUUID(),
      },
      data: {},
    });
    assert.equal(crossOrigin.status(), 403);
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    await stop(server);
  }
});

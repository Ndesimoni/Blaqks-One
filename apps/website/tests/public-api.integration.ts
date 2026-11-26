import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { livePage } from '../src/lib/live-page.ts';
import { PublicNotFound, PublicUnavailable, publicGet } from '../src/lib/public-api.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';

test('public API consumer binds scope, projects fields and fails closed on broken/withdrawn data', async () => {
  const site = { ...sampleSite('harbour.localhost')!, sample: false };
  const catalogue = sampleCatalogue(site);
  const requests: { path: string; cookie?: string; auth?: string }[] = [];
  let mode = 'normal';
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    requests.push({ path: req.url!, cookie: req.headers.cookie, auth: req.headers.authorization });
    if (mode === 'unavailable') {
      res.writeHead(503).end();
      return;
    }
    if (mode === 'withdrawn') {
      res.writeHead(404).end();
      return;
    }
    if (mode === 'redirect') {
      res.writeHead(302, { Location: '/api/crm/private' }).end();
      return;
    }
    const included = mode === 'foreign' ? sampleCatalogue(sampleSite('localhost')!) : catalogue;
    const data =
      mode === 'mismatch'
        ? catalogue.listings[1]
        : { ...catalogue.listings[0], exactAddress: 'PRIVATE-ADDRESS' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (url.pathname.endsWith('/listings'))
      res.end(
        JSON.stringify({
          data: [],
          included,
          pagination: { total: 0, page: 1, pageSize: 12 },
          errors: ['Maximum budget must be at least the minimum.'],
        }),
      );
    else res.end(JSON.stringify({ data, included }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const original = process.env.WEBSITE_API_ORIGIN;
  process.env.WEBSITE_API_ORIGIN = `http://127.0.0.1:${address.port}`;
  try {
    const data = await livePage(site, 'harbour.localhost', 'property', {}, '1');
    assert.equal(data.entity?.id, '1');
    assert.ok(!JSON.stringify(data).includes('PRIVATE-ADDRESS'));
    assert.match(
      requests[0].path,
      /^\/api\/public\/v1\/sites\/harbour\/listings\/1\?host=harbour.localhost$/,
    );
    assert.ok(requests.every((r) => !r.cookie && !r.auth));
    const invalid = await livePage(site, 'harbour.localhost', 'properties', {
      purpose: 'buy',
      minPrice: '3',
      maxPrice: '2',
    });
    assert.equal(invalid.results?.errors.length, 1);
    mode = 'mismatch';
    await assert.rejects(livePage(site, 'harbour.localhost', 'property', {}, '1'), PublicNotFound);
    await assert.rejects(
      livePage(site, 'harbour.localhost', 'enquiry', { listing: '1' }),
      PublicNotFound,
    );
    mode = 'foreign';
    await assert.rejects(
      livePage(site, 'harbour.localhost', 'property', {}, '1'),
      /scope mismatch/,
    );
    mode = 'unavailable';
    await assert.rejects(
      livePage(site, 'harbour.localhost', 'property', {}, '1'),
      PublicUnavailable,
    );
    mode = 'withdrawn';
    await assert.rejects(livePage(site, 'harbour.localhost', 'property', {}, '1'), PublicNotFound);
    mode = 'redirect';
    const before = requests.length;
    await assert.rejects(publicGet('sites/resolve', 'harbour.localhost'), PublicUnavailable);
    assert.equal(requests.length, before + 1);
    assert.ok(!requests.some((r) => r.path.startsWith('/api/crm')));
  } finally {
    if (original === undefined) delete process.env.WEBSITE_API_ORIGIN;
    else process.env.WEBSITE_API_ORIGIN = original;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformAgents } from '../src/lib/agent-directory.ts';
import type { Agent, Catalogue, PageData, Query, Site } from '../src/lib/types.ts';
import { samplePage } from '../src/lib/page-model.ts';
import { crmEntry } from '../src/lib/crm-entry.ts';

const site: Site = {
  id: 'general',
  kind: 'platform',
  name: 'Blaqks One',
  company: null,
  theme: '1',
  sample: false,
};
const agents: Agent[] = Array.from({ length: 29 }, (_, i) => ({
  id: String(i + 1),
  name: `Agent ${i + 1}`,
  company: 'synthetic',
  specialty: 'Residential',
}));
const catalogue: Catalogue = { agents, companies: [], listings: [], areas: [], developers: [] };

function loader(failAt = 0) {
  const calls: number[] = [];
  const load = async (
    _site: Site,
    _host: string,
    page: string,
    query: Query,
  ): Promise<PageData> => {
    const raw = Math.max(1, Number(query.page));
    calls.push(raw);
    if (raw === failAt) throw Error('Public API unavailable');
    const current = Math.min(raw, Math.ceil(agents.length / 12));
    return {
      site,
      page,
      query,
      catalogue: { ...catalogue, agents: agents.slice((current - 1) * 12, current * 12) },
      directory: { total: agents.length, page: current, pageSize: 12 },
    };
  };
  return { load, calls };
}

test('five-agent pages cover the whole upstream directory without skipping or duplicating agents', async () => {
  const upstream = loader();
  const seen: string[] = [];
  for (let page = 1; page <= 6; page++) {
    const data = await platformAgents(
      site,
      'public.example',
      { page: String(page), q: 'Agent' },
      upstream.load,
    );
    assert.equal(data.directory?.page, page);
    assert.equal(data.directory?.pageSize, 5);
    assert.equal(data.query.q, 'Agent');
    seen.push(...data.catalogue.agents.map((a) => a.id));
  }
  assert.deepEqual(
    seen,
    agents.map((a) => a.id),
  );
  assert.equal(new Set(seen).size, agents.length);
});

test('page crossing the twelve-item boundary requests both upstream pages', async () => {
  const upstream = loader();
  const data = await platformAgents(site, 'public.example', { page: '3' }, upstream.load);
  assert.deepEqual(
    data.catalogue.agents.map((a) => a.id),
    ['11', '12', '13', '14', '15'],
  );
  assert.deepEqual(upstream.calls, [1, 2]);
});

test('failed second page remains an error rather than an incomplete or sample result', async () => {
  await assert.rejects(
    platformAgents(site, 'public.example', { page: '3' }, loader(2).load),
    /unavailable/,
  );
});

test('out of range page clamps to the last complete UI page', async () => {
  const data = await platformAgents(site, 'public.example', { page: '999' }, loader().load);
  assert.equal(data.directory?.page, 6);
  assert.deepEqual(
    data.catalogue.agents.map((a) => a.id),
    ['26', '27', '28', '29'],
  );
});

test('sample platform uses five agents while other company themes keep twelve', () => {
  assert.equal(
    samplePage({ ...site, sample: true }, catalogue, 'agents', {})?.directory?.pageSize,
    5,
  );
  assert.equal(
    samplePage({ ...site, kind: 'company', theme: '3' }, catalogue, 'agents', {})?.directory
      ?.pageSize,
    12,
  );
});

test('professional entry rejects unsafe schemes, credentials and query data', () => {
  for (const value of [
    'javascript:alert(1)',
    'https://user:secret@example.com',
    'https://crm.example/?token=x',
    'http://crm.example',
  ]) {
    assert.equal(crmEntry(value), null);
  }
  assert.equal(crmEntry('https://crm.example'), 'https://crm.example/');
  assert.equal(crmEntry('http://localhost:5173'), 'http://localhost:5173/');
});

test('an unexpected second-page size fails closed', async () => {
  const normal = loader();
  const changing = async (s: Site, host: string, page: string, query: Query) => {
    const data = await normal.load(s, host, page, query);
    if (query.page === '2') data.directory!.pageSize = 5;
    return data;
  };
  await assert.rejects(
    platformAgents(site, 'public.example', { page: '3' }, changing),
    /pagination/,
  );
});

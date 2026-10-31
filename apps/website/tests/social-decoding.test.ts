// A bad stored social link never breaks a website (review SOC1 H1): decoders drop each
// failing link alone, and sample links stay valid, illustrative and scoped (H2, L4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCatalogue, decodeEntity, decodeSite } from '../src/lib/public-shapes.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';
import { publicSocial } from '../src/lib/social-links.ts';
import type { Agent, SocialLinks } from '../src/lib/types.ts';

const site = { id: 's', name: 'Keys with Simoni', kind: 'company', company: 's', theme: '1' };

test('site content links are decoded, and invalid ones are dropped individually', () => {
  const decoded = decodeSite({
    ...site,
    content: {
      tagline: 'Hello',
      social: {
        instagram: 'https://www.instagram.com/keys',
        facebook: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.example',
        x: 'javascript:alert(1)',
        website: 'https://keyswithsimoni.ae/',
        myspace: 'https://myspace.com/keys',
        youtube: 42,
      },
    },
  });
  assert.equal(decoded.content?.tagline, 'Hello');
  assert.ok(!('social' in (decoded.content ?? {})));
  assert.deepEqual(decoded.social, {
    instagram: 'https://www.instagram.com/keys',
    website: 'https://keyswithsimoni.ae/',
  });
  for (const social of ['https://instagram.com/k', ['x'], null, { tiktok: 'nope' }]) {
    const result = decodeSite({ ...site, content: { social } });
    assert.ok(!('social' in result), JSON.stringify(social));
  }
  assert.ok(!('social' in decodeSite({ ...site, content: null })));
});

test('agent links are decoded, null is accepted and bad links never fail the catalogue', () => {
  const agent = { id: 'a', name: 'Maya', company: 's', specialty: 'Sales' };
  const decoded = decodeEntity('agents', {
    ...agent,
    social: { linkedin: 'https://ae.linkedin.com/in/maya', tiktok: 'https://bit.ly/x' },
  }) as Agent;
  assert.deepEqual(decoded.social, { linkedin: 'https://ae.linkedin.com/in/maya' });
  assert.ok(!('social' in decodeEntity('agents', { ...agent, social: null })));
  assert.ok(!('social' in decodeEntity('agents', { ...agent, social: 'nope' })));
  const catalogue = decodeCatalogue({
    agents: [{ ...agent, social: { instagram: 'http://instagram.com/maya' } }],
  });
  assert.equal(catalogue.agents.length, 1);
  assert.ok(!('social' in catalogue.agents[0]));
});

test('sample links are valid home pages and keep member websites off the general site', () => {
  const all: SocialLinks[] = [];
  for (const host of ['localhost', 'harbour.localhost', 'cedar.localhost', 'dune.localhost']) {
    const sample = sampleSite(host)!;
    if (sample.social) all.push(sample.social);
    for (const agent of sampleCatalogue(sample).agents) if (agent.social) all.push(agent.social);
  }
  assert.ok(all.length > 6);
  for (const links of all) {
    assert.deepEqual(publicSocial(links), links);
    for (const url of Object.values(links))
      assert.match(
        url!,
        /^https:\/\/(www\.(instagram|facebook|tiktok|linkedin|youtube|example)\.com|x\.com)\/$/,
      );
  }
  const general = sampleCatalogue(sampleSite('localhost')!).agents;
  assert.ok(general.every((agent) => !agent.social?.website));
  assert.ok(general.some((agent) => agent.social));
  const company = sampleCatalogue(sampleSite('harbour.localhost')!).agents;
  assert.ok(company.find((agent) => agent.id === 'maya')?.social?.website);
});

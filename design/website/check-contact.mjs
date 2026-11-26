import { expect } from '@playwright/test';
import { agentContactLinks } from './contact.js';
import { agents, agentBy, propertyBy } from './data.js';

export async function checkContactLinks(page, base) {
  expect(agentContactLinks({ id: 'private', email: 'private@example.test' })).toEqual([]);
  expect(
    agentContactLinks({
      publicWhatsApp: 'javascript:alert(1)',
      publicEmail: 'a@b.test\r\nBcc:x@y.test',
    }),
  ).toEqual([]);
  expect(agentContactLinks(agents[0], { agent: 'someone-else' })).toEqual([]);
  expect(
    agentContactLinks({ ...agents[0], publicWhatsApp: '' }).map((link) => link.channel),
  ).toEqual(['email']);
  const externalRequests = [];
  const recordRequest = (request) => {
    if (!request.url().startsWith(base) && /^https?:/.test(request.url()))
      externalRequests.push(request.url());
  };
  page.on('request', recordRequest);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['1', '4']) {
      for (const path of [
        '#/properties',
        '#/company?id=harbour',
        '#/agent?id=adam',
        '#/properties?site=harbour',
        '#/agent?id=maya&site=harbour',
        '#/property?id=2',
        '#/property?id=1&site=harbour',
      ]) {
        await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}theme=${theme}`);
        for (const card of await page.locator('.property-card').all()) {
          const href = await card.locator('.property-image').getAttribute('href');
          const property = propertyBy(new URLSearchParams(href.split('?')[1]).get('id'));
          await verifyContacts(card, agentBy(property.agent), property);
        }
        if (path.startsWith('#/property?')) {
          const property = propertyBy(path.includes('id=2') ? '2' : '1');
          await verifyContacts(page.locator('.enquiry-panel'), agentBy(property.agent), property);
        }
        if (path.startsWith('#/agent?'))
          await verifyContacts(
            page.locator('.agent-profile'),
            agentBy(path.includes('adam') ? 'adam' : 'maya'),
          );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        for (const contact of await page.locator('.contact-actions a').all()) {
          const box = await contact.boundingBox();
          if (!box) continue;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
  await page.goto(`${base}#/property?id=2`);
  await page.locator('.enquiry-panel .contact-whatsapp').focus();
  await expect(page.locator('.enquiry-panel .contact-whatsapp')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.enquiry-panel .contact-email')).toBeFocused();
  expect(externalRequests).toEqual([]);
  page.off('request', recordRequest);
  return 'passed: listing-agent routing, context, public-only contacts, keyboard and 42 responsive route/theme checks';
}

async function verifyContacts(container, agent, property) {
  for (const item of agentContactLinks(agent, property)) {
    const anchor = container.locator(`.contact-${item.channel}`).first();
    await expect(anchor).toHaveAttribute('href', item.href);
    await expect(anchor).toHaveAccessibleName(new RegExp(`${item.label} ${agent.name}`));
    if (item.external) {
      await expect(anchor).toHaveAttribute('target', '_blank');
      await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    }
  }
}

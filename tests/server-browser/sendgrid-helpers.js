import { expect } from '@playwright/test';
import { freshAdmin, sendgridKey } from '../api/sendgrid-helpers.mjs';
import { staffMember } from '../api/mailbox-helpers.mjs';
import { noPageOverflow, setTheme } from './assign-helpers.js';

/**
 * A fresh company (so the shared fixtures' Google mailboxes never meet SendGrid) with an
 * Admin and one staff member who has the email grant, plus a unique synthetic domain.
 */
export async function sendgridCompany(label) {
  const tag = `${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await freshAdmin(`${tag}-admin`);
  const agent = await staffMember(admin, `${tag}-agent`, true);
  const domain = `${tag}.example.test`;
  return {
    admin: { email: `${tag}-admin@team-fixture.test`, name: `Synthetic ${tag}-admin` },
    agent: { email: `${tag}-agent@team-fixture.test`, name: `Synthetic ${tag}-agent` },
    agentId: agent.user.id,
    session: admin,
    domain,
    key: sendgridKey(domain),
  };
}

export const emailCard = (page) => page.getByRole('article', { name: 'Email', exact: true });
export const addressesCard = (page) => page.getByRole('region', { name: 'Sending addresses' });

/** Opens the Email card's connect form, which offers company email first. */
export async function openConnectForm(page) {
  await page.goto('/#/channels');
  await emailCard(page).getByRole('button', { name: 'Connect', exact: true }).click();
  const form = page.getByRole('form', { name: 'Connect Email' });
  await expect(form.getByLabel('Provider')).toHaveValue('sendgrid');
  await expect(form).toContainText('Before you connect, in SendGrid:');
  return form;
}

/** 1280px and 390px screenshots in both themes, each checked for sideways page scroll. */
export async function shots(page, testInfo, name) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.waitForTimeout(250);
      await noPageOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

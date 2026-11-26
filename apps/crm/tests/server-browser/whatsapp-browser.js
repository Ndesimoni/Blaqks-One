import { expect } from '@playwright/test';
import { query } from '../api/helpers.mjs';
import { sendingCompany } from '../api/whatsapp-send-helpers.mjs';
import { openRecord } from './assign-helpers.js';

// WhatsApp composer checks (W1b, docs/whatsapp-design.md §18) against the Twilio stand-in:
// every phone is a synthetic +999 number and every send stays on loopback.

/** A fresh company: its Twilio account, and numbers for the Admin and one agent. */
export const whatsappTeam = (label) =>
  sendingCompany(`${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);

/** Opens the client's record from Clients and presses Message; answers the dialog it opens. */
export async function messageClient(page, client, title = 'New WhatsApp message') {
  await page.goto('/#/clients');
  const panel = await openRecord(page, client.record.client_id);
  const name = client.record.full_name;
  await panel
    .locator('.record-panel-head')
    .getByRole('button', { name: `Message ${name}` })
    .click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Screenshots at 1280 and 390 in light and dark. An open dialog makes the theme switch
 * inert, so the theme attribute is set directly and restored afterwards.
 */
export async function themeShots(page, testInfo, name, height = 900) {
  const theme = await page.locator('html').getAttribute('data-theme');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height });
    for (const next of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), next);
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${next}.png`) });
    }
  }
  await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
  await page.setViewportSize({ width: 1280, height });
}

/** The workspace's newest WhatsApp message and its conversation. */
export function latestWhatsapp(workspace) {
  const [conversation, message] = query(`SELECT c.id||'|'||m.id
    FROM inbox.crm_inbox_conversations c
    JOIN inbox.crm_inbox_messages m ON m.conversation_id=c.id
    WHERE c.workspace_id='${workspace}' AND c.channel='whatsapp'
    ORDER BY m.created_at DESC LIMIT 1`).split('|');
  return { conversation, message };
}

/** Records agreement through the open panel, after checking a source is required. */
export async function recordAgreement(scope, source = 'By phone') {
  await scope.getByRole('button', { name: 'Record agreement' }).click();
  const panel = scope.getByRole('form', { name: 'Client’s agreement to WhatsApp messages' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Record agreement' }).click();
  await expect(panel).toContainText('Choose how the client agreed.');
  await expect(panel.getByRole('radio', { name: 'By phone' })).toBeFocused();
  await panel.getByRole('radio', { name: source }).check();
  await panel.getByRole('button', { name: 'Record agreement' }).click();
  await expect(panel).toHaveCount(0);
  return panel;
}

import { query } from '../api/helpers.mjs';
import { add } from './assign-fixtures.js';
import { signInMember } from './assign-helpers.js';

/** Loads the app shell first, so the shared sign-in helper only waits for the sign-in. */
export async function openMember(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Email address').waitFor({ timeout: 30000 });
  await signInMember(page, email);
  return { context, page };
}

/** A company ready to apply: eight days old, with every checklist line met. */
export async function prepare(team) {
  const workspace = team.admin.user.workspaceId;
  query(`UPDATE crm_workspaces SET created_at=now()-interval '8 days' WHERE id='${workspace}'`);
  for (let i = 0; i < 5; i += 1) await add(team.admin, 'Properties', { property_id: `MK-BR-${i}` });
  for (let i = 0; i < 5; i += 1)
    await add(team.admin, 'Clients', { full_name: `Marketplace client ${i}` });
  for (let i = 0; i < 3; i += 1) await add(team.admin, 'Contacts', { contact_id: `MK-BC-${i}` });
  for (let i = 0; i < 3; i += 1) await add(team.admin, 'Follow-ups', { activity_id: `MK-BF-${i}` });
  await add(team.admin, 'Viewings', { viewing_id: 'MK-BV' });
}

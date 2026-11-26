import { test, expect } from './fixtures.js';
import { signIn, signOut } from './helpers.js';
import { setTheme } from './assign-helpers.js';

// BO1c (docs/blaqks-one-console.md §11): any member asks Blaqks One for help, the Blaqks One
// team answers and solves in its queue, and only those two sides read the request.
test('a member asks for help, Blaqks One answers and solves, and the member reads it', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const subject = `Synthetic help ${Date.now()}`;
  await signIn(page);
  await setTheme(page, 'light');
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Help');
  await page.getByRole('button', { name: 'Ask for help', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Ask for help' });
  await form.getByLabel('What is it about?').selectOption('account');
  await form.getByLabel('Subject').fill(subject);
  await form.getByLabel('Your message').fill('I cannot find where to change my password.');
  await form.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Request sent');
  const thread = page.getByRole('region', { name: 'Conversation' });
  await expect(thread.getByRole('heading', { name: subject })).toBeVisible();
  await expect(thread).toContainText('Open');
  await signOut(page);

  await signIn(page, 'owner');
  await page.goto('/#/platform-help');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Help requests');
  await page.getByRole('button', { name: new RegExp(subject) }).click();
  const queue = page.getByRole('region', { name: 'Conversation' });
  await expect(queue).toContainText('Fixture Admin A');
  await queue.getByLabel('Write an answer').fill('Open Settings, then Sign-in and security.');
  await queue.getByRole('button', { name: 'Send answer', exact: true }).click();
  await expect(queue).toContainText('Answered');
  await queue.getByRole('button', { name: 'Mark solved', exact: true }).click();
  await expect(queue).toContainText('Solved');
  await page.screenshot({ path: testInfo.outputPath('help-queue-light.png') });
  await signOut(page);

  await signIn(page);
  await expect(page.locator('.account-dot')).toBeVisible();
  await page.goto('/#/help');
  await page.getByRole('button', { name: new RegExp(subject) }).click();
  await expect(page.getByRole('region', { name: 'Conversation' })).toContainText(
    'Open Settings, then Sign-in and security.',
  );
  await page.screenshot({ path: testInfo.outputPath('help-member-light.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'dark');
  await page.screenshot({ path: testInfo.outputPath('help-member-390-dark.png') });
});

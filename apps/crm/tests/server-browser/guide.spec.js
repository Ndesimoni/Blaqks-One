import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';

test('the guide lists articles by topic, searches them and opens an article', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/guide');
  const main = page.getByRole('main');
  await expect(main.locator('.guide-groups h3')).toHaveText([
    'CRM',
    'Websites',
    'Marketplace',
    'Messages',
    'Settings',
    'How it works',
  ]);
  const search = page.getByRole('textbox', { name: 'Search the guide' });
  await expect(search).toHaveAttribute('placeholder', 'Search the guide');
  await search.fill('whatsapp number');
  await expect(main.locator('.guide-item')).toHaveCount(1);
  await page.getByRole('group', { name: 'Filter the guide' }).getByText('Websites').click();
  await expect(page.getByText('No guide matches your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filter' }).click();
  await expect(search).toHaveValue('');

  await page.getByRole('button', { name: /^Adding a client and their first follow-up/ }).click();
  const article = page.getByRole('article', { name: 'Adding a client and their first follow-up' });
  await expect(article.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(article).toContainText('Where to find it:');
  await expect(article.locator('.guide-steps li')).toHaveCount(5);
  const related = page.getByRole('complementary', { name: 'Related' });
  await expect(related.locator('.guide-item')).toHaveCount(3);
  await related.locator('.guide-item').first().click();
  await expect(page.locator('.guide-article h2')).toHaveText(
    'Matching properties on the Client desk',
  );
  await page.getByRole('button', { name: 'All guides' }).click();
  await expect(search).toBeVisible();
  await page.getByRole('button', { name: /^Keeping owners, developers/ }).click();
  await page.getByRole('button', { name: 'Open Contacts' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Contacts', exact: true }),
  ).toBeVisible();
});

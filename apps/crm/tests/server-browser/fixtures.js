import { test as base, expect } from '@playwright/test';
import { query } from '../api/helpers.mjs';

/** The website home that signing out leads to (VITE_WEBSITE_URL in scripts/crm-test-env.mjs). */
export const WEBSITE = 'http://blaqks-one.test/';

/** Answers the website stand-in in this browser context, with a link to the CRM sign-in. */
export async function answerWebsite(context) {
  await context.route(`${WEBSITE}**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Blaqks One</title><h1>Blaqks One website</h1><a href="http://localhost:5175/#/sign-in">Sign in</a>',
    }),
  );
}

// Each scenario uses the disposable harness database and its own sign-in budget.
// The API suite separately verifies that real rate limits reject excess attempts.
export const test = base.extend({
  context: async ({ context }, use) => {
    await answerWebsite(context);
    await use(context);
  },
  loginBudget: [
    async ({}, use) => {
      query('TRUNCATE crm_login_limits');
      await use();
    },
    { auto: true },
  ],
});

export { expect };

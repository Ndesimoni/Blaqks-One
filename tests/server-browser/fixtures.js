import { test as base, expect } from '@playwright/test';
import { query } from '../api/helpers.mjs';

// Each scenario uses the disposable harness database and its own sign-in budget.
// The API suite separately verifies that real rate limits reject excess attempts.
export const test = base.extend({
  loginBudget: [
    async ({}, use) => {
      query('TRUNCATE crm_login_limits');
      await use();
    },
    { auto: true },
  ],
});

export { expect };

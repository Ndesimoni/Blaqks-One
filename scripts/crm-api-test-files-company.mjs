/** Company profile and sign-up API suites, in their run order (see crm-api-test-files.mjs). */
export const companyTestFiles = [
  'apps/crm/tests/api/company-profile.test.mjs',
  'apps/crm/tests/api/company-office.test.mjs',
  'apps/crm/tests/api/company-access.test.mjs',
  'apps/crm/tests/api/company-migration.test.mjs',
  'apps/crm/tests/api/company-free-seats-migration.test.mjs',
  'apps/crm/tests/api/company-races.test.mjs',
  'apps/crm/tests/api/platform-companies.test.mjs',
  'apps/crm/tests/api/platform-team.test.mjs',
  'apps/crm/tests/api/platform-team-areas.test.mjs',
  'apps/crm/tests/api/platform-team-controls.test.mjs',
  'apps/crm/tests/api/platform-team-delegation.test.mjs',
  'apps/crm/tests/api/platform-team-credentials.test.mjs',
  'apps/crm/tests/api/platform-metrics.test.mjs',
  'apps/crm/tests/api/platform-events.test.mjs',
  'apps/crm/tests/api/platform-metrics-websites.test.mjs',
];

export const signupTestFiles = [
  'apps/crm/tests/api/signup-start.test.mjs',
  'apps/crm/tests/api/signup-verify.test.mjs',
  'apps/crm/tests/api/signup-enumeration.test.mjs',
  'apps/crm/tests/api/signup-limits.test.mjs',
  'apps/crm/tests/api/signup-races.test.mjs',
  'apps/crm/tests/api/signup-release-races.test.mjs',
  'apps/crm/tests/api/signup-invitations.test.mjs',
];

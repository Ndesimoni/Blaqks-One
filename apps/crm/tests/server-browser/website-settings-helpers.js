import { randomUUID } from 'node:crypto';
import { expect } from './fixtures.js';
import { assignmentTeams } from '../api/assignment-helpers.mjs';
import { ok, publicRequest, put, websitePath } from '../api/website-helpers.mjs';
import { signInMember } from './assign-helpers.js';

/** Every scenario owns synthetic teams; only the shared platform's version is reused. */
export async function settingsTeam(prefix, { site = true, eligible = true } = {}) {
  const teams = await assignmentTeams(`cms-${prefix}-${randomUUID().slice(0, 6)}`);
  const platformPath = '/platform/websites/general';
  const current = ok(await teams.owner.request(platformPath)).site;
  const platform = ok(
    await put(teams.owner, platformPath, {
      version: current?.version || 0,
      name: 'Synthetic Blaqks One',
      host: 'blaqks.localhost',
      theme: '1',
      content: { heroTitle: 'Published platform introduction' },
    }),
  ).site;
  let company = null;
  if (site) {
    company = ok(
      await put(teams.admin, websitePath(teams.admin), {
        version: 0,
        name: 'Synthetic Harbour Property',
        slug: `cms-${randomUUID().slice(0, 8)}`,
        theme: '1',
        company: { mark: 'HP', area: 'Dubai', note: 'Synthetic public company description.' },
        content: { heroTitle: 'Published company introduction' },
      }),
    ).site;
    if (eligible) company = await allowCompany(teams.owner, company);
  }
  return { ...teams, platform, company };
}

export async function allowCompany(owner, company) {
  return ok(
    await put(owner, `/platform/websites/companies/${company.workspace}/eligibility`, {
      version: company.version,
      entitled: true,
      licenceVerified: true,
    }),
  ).site;
}

export async function openWebsite(page, admin) {
  await signInMember(page, admin.user.email);
  await page.goto('/#/website');
  await expect(page.locator('.page-heading h1')).toHaveText('Website');
}

export async function currentSite(admin) {
  return ok(await admin.request(websitePath(admin))).site;
}

export async function currentDraft(admin) {
  return ok(await admin.request(websitePath(admin, '/draft')));
}

export const companyInput = (site, content = site.content) => ({
  version: site.version,
  name: site.name,
  theme: site.theme,
  active: site.active,
  company: { mark: site.company.mark, area: site.company.area, note: site.company.note },
  content,
});

export const resolveSite = (site) =>
  publicRequest(`sites/resolve?host=${encodeURIComponent(site.host)}`);

/** Public reads never borrow the signed-in browser's CRM cookies. */
export async function expectPublicHero(site, title) {
  await expect
    .poll(async () => (await resolveSite(site)).value?.data?.content?.heroTitle)
    .toBe(title);
}

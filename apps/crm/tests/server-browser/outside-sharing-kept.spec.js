import { test, expect } from './fixtures.js';
import { setAssignee } from '../api/assignment-helpers.mjs';
import { accepted, listing, outsideTeams } from '../api/outside-sharing-helpers.mjs';
import { findMember, memberUpdate, teamPath } from '../api/team-helpers.mjs';
import { memberPage } from './assign-helpers.js';
import { shots } from './agreements-helpers.js';

// R2a review follow-ups (docs/record-sharing.md): whoever shared a listing keeps the record
// after it moves on, blurred (L7); a suspended sending company pauses its shares (L6).
const title = 'Synthetic Kept Villa';
const label = new RegExp(`^${title} · Dubai Hills$`);

async function company(teams, active) {
  const member = await findMember(teams.owner, teams.admin.user.id);
  const result = await teams.owner.request(teamPath(teams.owner, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active }),
  });
  if (result.status !== 200) throw Error(JSON.stringify(result.value));
}

test('the sharer keeps a blurred record after the listing moves; a suspension pauses it', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const teams = await outsideTeams('outside-kept');
  const moved = await listing(teams, 'one', { listing_title: title });
  const share = await accepted(teams.one, moved, teams.agent);
  setAssignee(moved.id, teams.two.user.id);
  const paused = await accepted(
    teams.one,
    await listing(teams, 'one', { listing_title: title }),
    teams.agent,
  );
  const sharer = await memberPage(browser, 'outside-kept-one@team-fixture.test');
  const agent = await memberPage(browser, 'outside-kept-agent@team-fixture.test');
  try {
    await sharer.page.goto(`/#/listing-shares/${share.id}`);
    const kept = sharer.page.getByRole('dialog', { name: label });
    const hidden = kept.getByRole('region', { name: 'Listing hidden' });
    await expect(hidden).toContainText(/^Shared with Synthetic outside-kept-agent at /);
    await expect(hidden).toContainText('You no longer hold this listing');
    await expect(kept).not.toContainText('Bright villa');
    await expect(kept.getByRole('button', { name: /evidence/i })).toBeVisible();
    await shots(sharer.page, testInfo, 'kept-share');

    await company(teams, false);
    await agent.page.goto(`/#/listing-shares/${paused.id}`);
    const away = agent.page.getByRole('dialog', { name: label });
    await expect(away).toContainText('This listing isn’t available right now.');
    await expect(away).not.toContainText('Bright villa');
    await expect(away.getByRole('button', { name: 'Propose co-broking' })).toHaveCount(0);
    await shots(agent.page, testInfo, 'paused-share');
  } finally {
    await company(teams, true);
    await Promise.all([sharer, agent].map((member) => member.context.close()));
  }
});

import { expect } from './fixtures.js';

/** Open each named broker from request activity and prove their public profile is available. */
export async function expectMarketplaceProfiles(page, activity, members) {
  for (const member of members) {
    await activity.getByRole('button', { name: `View ${member.user.name}'s profile` }).click();
    const profile = page.getByRole('dialog').last();
    await expect(profile).toContainText(member.user.name);
    await profile.getByRole('button', { name: 'Close Marketplace profile' }).click();
  }
}

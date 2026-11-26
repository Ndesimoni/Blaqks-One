import { positionLabel } from '../server/profile/profileModel.js';

const list = (items) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);

/** "Join Keys with Simoni" (the mockup); an Admin invited by Blaqks One joins the platform. */
export function invitationTitle(invitation, t) {
  if (invitation?.roleId === 'admin') return t('auth.invite.titleAdmin');
  if (invitation?.company) return t('auth.invite.title', { company: invitation.company });
  return t('auth.invite.titleTeam');
}

/** Who invited them and as what, then what to do: "Aidah invited you as Sales Agent." */
export function invitationIntro(invitation, t) {
  const owner = invitation.ownerName;
  if (invitation.roleId === 'admin') return t('auth.invite.bodyAdmin', { owner });
  const positions = (invitation.positions ?? []).map(positionLabel);
  if (!positions.length) return t('auth.invite.bodyTeam', { owner });
  return t('auth.invite.body', { owner, positions: list(positions) });
}

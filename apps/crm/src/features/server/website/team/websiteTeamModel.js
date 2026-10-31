import { memberStatus } from '../../../server-team/teamDirectoryModel.js';

/**
 * Website profiles for the Admin's Team tab and each member's own My profile section. The
 * editable form, its checks and the save body live in profileFormModel.js.
 */
export {
  PROFILE_FIELDS,
  firstInvalid,
  formChanged,
  profileBody,
  profileErrors,
  profileForm,
} from './profileFormModel.js';

export const STATUS_TONES = {
  notSetUp: 'slate',
  waiting: 'amber',
  public: 'green',
  hidden: 'slate',
};

/** Not set up → Hidden (the Admin's choice) → Waiting for consent → Public. */
export function profileStatus(profile) {
  if (!profile) return 'notSetUp';
  if (!profile.active) return 'hidden';
  if (!profile.consent) return 'waiting';
  return 'public';
}

/** Active listings per agent profile id. */
export function liveCounts(publications) {
  const counts = {};
  for (const entry of Array.isArray(publications) ? publications : []) {
    if (entry?.active && entry.agentProfileId)
      counts[entry.agentProfileId] = (counts[entry.agentProfileId] || 0) + 1;
  }
  return counts;
}

/** The server's agent rule: shown and agreed, and either granted or the Admin. */
export function canPublishAsAgent(profile, isAdmin) {
  return Boolean(profile?.consent && profile.active && (profile.canPublish || isAdmin));
}

/** A website profile is possible for the Admin and for staff who can open Properties. */
export function canHaveProfile(member) {
  return member?.roleId === 'admin' || member?.permissions?.properties === true;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The signed-in Admin (`viewer`; the team list holds only their staff) and current staff,
 * each with their profile, status and live count; the Admin first.
 */
export function teamRows({ members, profiles, publications, viewer }) {
  const byMember = new Map((profiles || []).map((profile) => [profile.member, profile]));
  const counts = liveCounts(publications);
  const staff = (members || []).filter(
    (member) => member.id !== viewer?.id && memberStatus(member) === 'active',
  );
  return (viewer ? [viewer, ...staff] : staff)
    .map((member) => {
      const profile = byMember.get(member.id) || null;
      return {
        member,
        profile,
        own: member.id === viewer?.id,
        admin: member.roleId === 'admin',
        eligible: canHaveProfile(member),
        status: profileStatus(profile),
        live: profile ? counts[profile.id] || 0 : 0,
      };
    })
    .sort(
      (a, b) => Number(b.admin) - Number(a.admin) || collator.compare(a.member.name, b.member.name),
    );
}

/** Maps a refused save to a catalogue key; other refusals show the server's own text. */
export function profileFailure(error) {
  if (error?.status === 409 && error.details?.code === 'version_conflict') return 'stale';
  if (error?.status === 409) return 'noSite';
  if (error?.status === 404) return 'noAccess';
  return '';
}

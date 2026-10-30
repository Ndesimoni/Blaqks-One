import { memberStatus } from '../../../server-team/teamDirectoryModel.js';

/**
 * Website profiles for the Admin's Team tab and each member's own My profile section. Limits
 * mirror services/crm-api/src/sites/validation.rs (text ≤100/200 characters without < or >,
 * phones as +country digits, emails with one @ and a dotted host).
 */
export const STATUS_TONES = {
  notSetUp: 'slate',
  waiting: 'amber',
  public: 'green',
  hidden: 'slate',
};
export const PROFILE_FIELDS = ['name', 'specialty', 'publicWhatsApp', 'publicEmail'];

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

/** Editable public details; a new profile starts from the account name. */
export function profileForm(profile, fallbackName = '') {
  const body = profile?.body || {};
  return {
    name: body.name || fallbackName || '',
    specialty: body.specialty || '',
    publicWhatsApp: body.publicWhatsApp || '',
    publicEmail: body.publicEmail || '',
    consent: Boolean(profile?.consent),
  };
}

const plainText = (value, max) =>
  Boolean(value) && [...value].length <= max && !/[<>]/.test(value) && !/\p{Cc}/u.test(value);

function validEmail(value) {
  const at = value.indexOf('@');
  const host = value.slice(at + 1);
  return (
    at > 0 &&
    host.includes('.') &&
    !host.includes('@') &&
    new TextEncoder().encode(value).length <= 254 &&
    !/\s|[<>]/.test(value)
  );
}

/** The catalogue key of the first problem per field, mirroring the server's checks. */
export function profileErrors(form) {
  const errors = {};
  if (!plainText(form.name.trim(), 100)) errors.name = 'error.name';
  if (!plainText(form.specialty.trim(), 200)) errors.specialty = 'error.specialty';
  const phone = form.publicWhatsApp.trim();
  if (phone && !/^\+\d{7,15}$/.test(phone)) errors.publicWhatsApp = 'error.whatsApp';
  const email = form.publicEmail.trim();
  if (email && !validEmail(email)) errors.publicEmail = 'error.email';
  return errors;
}

/**
 * The PUT body. Only the member changes their own consent (`self`); anyone else's edit sends
 * the saved consent unchanged, as the server requires. Visibility stays as saved unless the
 * caller sets `active` (the Admin's Hide/Show).
 */
export function profileBody(form, profile, { self = false, active } = {}) {
  const phone = form.publicWhatsApp.trim();
  const email = form.publicEmail.trim();
  return {
    version: profile?.version ?? 0,
    name: form.name.trim(),
    specialty: form.specialty.trim(),
    ...(phone ? { publicWhatsApp: phone } : {}),
    ...(email ? { publicEmail: email } : {}),
    consent: self ? Boolean(form.consent) : Boolean(profile?.consent),
    active: active ?? profile?.active ?? true,
  };
}

/** True when the form differs from the saved profile (or its starting values). */
export const formChanged = (form, initial) =>
  Object.keys(initial).some((key) =>
    typeof initial[key] === 'string'
      ? form[key].trim() !== initial[key].trim()
      : form[key] !== initial[key],
  );

/** Maps a refused save to a catalogue key; other refusals show the server's own text. */
export function profileFailure(error) {
  if (error?.status === 409 && error.details?.code === 'version_conflict') return 'stale';
  if (error?.status === 409) return 'noSite';
  if (error?.status === 404) return 'noAccess';
  return '';
}

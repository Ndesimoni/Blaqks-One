import { SOCIAL_FIELDS, fromSocial, socialErrors, toSocial } from '../social/socialModel.js';

/**
 * The public profile form shared by My profile and the Admin's Edit profile dialog. Limits
 * mirror services/crm-api/src/sites/validation.rs (text ≤100/200 characters without < or >,
 * phones as +country digits, emails with one @ and a dotted host) and sites/social.rs.
 */
export const PROFILE_FIELDS = ['name', 'specialty', 'publicWhatsApp', 'publicEmail'];

/** Editable public details; a new profile starts from the account name. */
export function profileForm(profile, fallbackName = '') {
  const body = profile?.body || {};
  return {
    name: body.name || fallbackName || '',
    specialty: body.specialty || '',
    publicWhatsApp: body.publicWhatsApp || '',
    publicEmail: body.publicEmail || '',
    social: fromSocial(body.social),
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

/**
 * The first problem per field, mirroring the server's checks: `websiteTeam` catalogue keys
 * for the details and `websiteSocial` keys (by network) for the links.
 */
export function profileErrors(form) {
  const errors = {};
  if (!plainText(form.name.trim(), 100)) errors.name = 'error.name';
  if (!plainText(form.specialty.trim(), 200)) errors.specialty = 'error.specialty';
  const phone = form.publicWhatsApp.trim();
  if (phone && !/^\+\d{7,15}$/.test(phone)) errors.publicWhatsApp = 'error.whatsApp';
  const email = form.publicEmail.trim();
  if (email && !validEmail(email)) errors.publicEmail = 'error.email';
  return { ...errors, ...socialErrors(form.social) };
}

/** The field to focus after a refused check, in the order the form shows them. */
export const firstInvalid = (errors) =>
  [...PROFILE_FIELDS, ...SOCIAL_FIELDS].find((field) => errors[field]);

/**
 * The PUT body. Only the member changes their own consent, public contacts and social links
 * (`self`); anyone else's edit sends the saved consent and contacts unchanged and leaves the
 * links out, so the server keeps them (owner, 2026-10-30; sites/profile_rules.rs). Visibility
 * stays as saved unless the caller sets `active` (Hide/Show).
 */
export function profileBody(form, profile, { self = false, active } = {}) {
  const contacts = self ? form : profileForm(profile, '');
  const phone = contacts.publicWhatsApp.trim();
  const email = contacts.publicEmail.trim();
  const social = self ? toSocial(form.social) : undefined;
  return {
    version: profile?.version ?? 0,
    name: form.name.trim(),
    specialty: form.specialty.trim(),
    ...(phone ? { publicWhatsApp: phone } : {}),
    ...(email ? { publicEmail: email } : {}),
    ...(social ? { social } : {}),
    consent: self ? Boolean(form.consent) : Boolean(profile?.consent),
    active: active ?? profile?.active ?? true,
  };
}

/** Text compares without surrounding spaces; groups such as the links compare field by field. */
function same(value, initial) {
  if (typeof initial === 'string') return String(value ?? '').trim() === initial.trim();
  if (initial && typeof initial === 'object')
    return Object.keys(initial).every((key) => same(value?.[key], initial[key]));
  return value === initial;
}

/** True when the form differs from the saved profile (or its starting values). */
export const formChanged = (form, initial) =>
  Object.keys(initial).some((key) => !same(form[key], initial[key]));

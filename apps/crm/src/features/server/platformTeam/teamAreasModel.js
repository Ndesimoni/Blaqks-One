import { AREA_LEVELS, PLATFORM_AREAS } from '../platformAccess.js';

/** Every area at its highest level: the Manager position. */
const everything = () =>
  Object.fromEntries(PLATFORM_AREAS.map((area) => [area, AREA_LEVELS[area].at(-1)]));

/**
 * Positions named by the owner (2026-11-05) for people who work at Blaqks One, never in a
 * company. A position fills the levels; the saved levels decide (docs/blaqks-one-console.md §8).
 */
export const PRESETS = {
  manager: everything(),
  sales: { clients: 'manage', companies: 'view' },
  support: { companies: 'view', help_requests: 'manage' },
  analyst: { dashboard: 'view' },
};
export const PRESET_KEYS = ['manager', 'sales', 'support', 'analyst', 'custom'];

/** Only the areas switched on, in the fixed order. */
export const cleanAccess = (access) =>
  Object.fromEntries(PLATFORM_AREAS.filter((area) => access[area]).map((a) => [a, access[a]]));

/** The position whose levels match exactly, else custom. */
export function presetFor(access) {
  const key = JSON.stringify(cleanAccess(access));
  const match = Object.entries(PRESETS).find(
    ([, levels]) => JSON.stringify(cleanAccess(levels)) === key,
  );
  return match ? match[0] : 'custom';
}

/** One area set to 'off', 'view' or 'manage' (only levels the area allows). */
export function setLevel(access, area, level) {
  if (level !== 'off' && !AREA_LEVELS[area].includes(level)) return access;
  const next = { ...access };
  if (level === 'off') delete next[area];
  else next[area] = level;
  return cleanAccess(next);
}

export const blankStaff = () => ({
  name: '',
  email: '',
  phone: '',
  preset: 'sales',
  access: { ...PRESETS.sales },
});

/** The form's first problem as a catalogue key, or ''. */
export function staffError(form, inviting) {
  if (inviting && !form.name.trim()) return 'platformTeam.errorName';
  if (inviting && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
    return 'platformTeam.errorEmail';
  if (inviting && !/^\+[1-9]\d{7,14}$/.test(form.phone.trim())) return 'platformTeam.errorPhone';
  if (!Object.keys(cleanAccess(form.access)).length) return 'platformTeam.errorAreas';
  return '';
}

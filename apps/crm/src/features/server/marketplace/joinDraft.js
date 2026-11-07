/**
 * The join and edit form's draft (broker marketplace §2, packet MK1b). Choices are held as the
 * server's values; communities are typed one per line and trimmed into names. Validation
 * returns a code the screen translates, never an English sentence.
 */
export const EMIRATES = Object.freeze([
  'dubai',
  'abu-dhabi',
  'sharjah',
  'ajman',
  'umm-al-quwain',
  'ras-al-khaimah',
  'fujairah',
]);

export const PROPERTY_TYPES = Object.freeze([
  'residential_sale',
  'residential_rent',
  'commercial_sale',
  'commercial_rent',
]);

export const AUTHORITIES = Object.freeze(['RERA', 'ADREC', 'other']);

export const emptyDraft = () => ({
  emirates: [],
  communities: '',
  propertyTypes: [],
  experienceYears: 0,
  licenceNumber: '',
  licenceAuthority: 'RERA',
});

export const draftFromProfile = (profile) => ({
  emirates: [...profile.emirates],
  communities: profile.communities.join('\n'),
  propertyTypes: [...profile.propertyTypes],
  experienceYears: profile.experienceYears,
  licenceNumber: profile.licence ? profile.licence.number : '',
  licenceAuthority: profile.licence ? profile.licence.authority : 'RERA',
});

export const communityNames = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** The `profile` body the server validates again. */
export function profilePayload(draft) {
  const number = draft.licenceNumber.trim();
  return {
    emirates: draft.emirates,
    communities: communityNames(draft.communities),
    propertyTypes: draft.propertyTypes,
    experienceYears: Number(draft.experienceYears) || 0,
    licence: number ? { number, authority: draft.licenceAuthority } : null,
  };
}

/** A code for the first incomplete or invalid field, or '' when the step may advance. */
export function profileProblem(draft) {
  if (!draft.emirates.length) return 'emirates';
  if (!draft.propertyTypes.length) return 'types';
  const names = communityNames(draft.communities);
  if (names.length > 12) return 'communities';
  // The server's rule: English letters, digits, spaces and ' - & only (no dots, so no domains).
  if (names.some((name) => name.length > 60 || !/^[A-Za-z0-9 '&-]+$/.test(name)))
    return 'communityText';
  const years = Number(draft.experienceYears);
  if (!Number.isInteger(years) || years < 0 || years > 60) return 'years';
  const number = draft.licenceNumber.trim();
  if (number && !/^[A-Za-z0-9]{1,20}$/.test(number)) return 'licence';
  return '';
}

/** All four commitments ticked and the separate consent given. */
export const agreed = (ticks, consent) =>
  ticks.length > 0 && ticks.every(Boolean) && consent === true;

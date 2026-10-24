/**
 * The member side of the marketplace, read strictly (packet MK1b): the current terms, the
 * caller's own profile and what another joined member may see. Unknown shapes are refused.
 */
const invalid = () => new Error('The server returned invalid marketplace information.');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const count = (value) => {
  if (!Number.isInteger(value) || value < 0) throw invalid();
  return value;
};
const text = (value, max = 500) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value.trim();
};
const texts = (value, max) => {
  if (!Array.isArray(value) || value.length > max) throw invalid();
  return value.map((item) => text(item, 60));
};
const flag = (value) => {
  if (typeof value !== 'boolean') throw invalid();
  return value;
};
const stamp = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value)))
    throw invalid();
  return value;
};

function readLicence(value) {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw invalid();
  const number = text(value.number, 20);
  const authority = text(value.authority, 20);
  if (!number || !authority) throw invalid();
  return { number, authority };
}

/** The caller's own stored profile. */
export function readOwnProfile(value) {
  if (!isObject(value)) throw invalid();
  return {
    emirates: texts(value.emirates, 7),
    communities: texts(value.communities, 12),
    propertyTypes: texts(value.propertyTypes, 4),
    experienceYears: count(value.experienceYears),
    licence: readLicence(value.licence),
    joinedAt: stamp(value.joinedAt),
    hasPhoto: flag(value.hasPhoto),
    version: count(value.version),
  };
}

/** `member` from `GET /status`. */
export function readMember(value) {
  if (!isObject(value)) throw invalid();
  return {
    joined: flag(value.joined),
    profile: value.profile ? readOwnProfile(value.profile) : null,
    termsCurrent: flag(value.termsCurrent),
    termsVersion: text(value.termsVersion, 40),
    termsDigest: text(value.termsDigest, 64),
  };
}

/** `GET /terms/{version}`: the text, the consent and the four commitments. */
export function readTerms(value) {
  if (!isObject(value) || !isObject(value.terms)) throw invalid();
  const terms = value.terms;
  if (!Array.isArray(terms.commitments) || terms.commitments.length !== 4) throw invalid();
  return {
    version: text(terms.version, 40),
    body: text(terms.body, 20000),
    consent: text(terms.consent, 1000),
    commitments: terms.commitments.map((line) => text(line, 300)),
    digest: text(terms.digest, 64),
    draft: Boolean(terms.draft),
  };
}

/** `GET /profiles/{memberId}`: another joined member, never an email or a phone. */
export function readProfile(value) {
  if (!isObject(value) || !isObject(value.profile)) throw invalid();
  const profile = value.profile;
  return {
    memberId: text(profile.memberId, 64),
    name: text(profile.name, 120),
    company: text(profile.company, 120),
    emirates: texts(profile.emirates, 7),
    communities: texts(profile.communities, 12),
    propertyTypes: texts(profile.propertyTypes, 4),
    experienceYears: count(profile.experienceYears),
    licence: readLicence(profile.licence),
    joinedAt: stamp(profile.joinedAt),
    hasPhoto: flag(profile.hasPhoto),
    declared: flag(profile.declared),
  };
}

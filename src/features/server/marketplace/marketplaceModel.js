/**
 * The marketplace's answers, read strictly (broker marketplace MK1): only the known state,
 * switch, checklist numbers and the company's own terms come through. Anything else is
 * refused rather than half-shown.
 */
export const marketplaceStates = Object.freeze([
  'not_applied',
  'pending',
  'approved',
  'declined',
  'revoked',
]);

const invalid = () => new Error('The server returned invalid marketplace information.');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const count = (value) => {
  if (!Number.isInteger(value) || value < 0) throw invalid();
  return value;
};
/** A count the server may hold back (staff see only which lines are met). */
const maybeCount = (value) => (value === null || value === undefined ? null : count(value));
const LINES = ['age', 'properties', 'clients', 'contacts', 'followUps', 'viewings', 'recent'];
const text = (value, max = 500) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value.trim();
};
const stamp = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value)))
    throw invalid();
  return value;
};
const state = (value) => {
  if (!marketplaceStates.includes(value)) throw invalid();
  return value;
};

function readChecklist(value) {
  if (!isObject(value)) throw invalid();
  const lines = isObject(value.lines)
    ? Object.fromEntries(LINES.map((key) => [key, value.lines[key] === true]))
    : null;
  return {
    ageDays: maybeCount(value.ageDays),
    properties: maybeCount(value.properties),
    clients: maybeCount(value.clients),
    contacts: maybeCount(value.contacts),
    followUps: maybeCount(value.followUps),
    viewings: maybeCount(value.viewings),
    recent: Boolean(value.recent),
    met: Boolean(value.met),
    lines,
  };
}

import { readMember } from './marketplaceProfileModel.js';

/** `{ company: {...}, member }` from `GET /status`. */
export function readMarketplaceStatus(value) {
  if (!isObject(value) || !isObject(value.company)) throw invalid();
  const company = value.company;
  return {
    company: {
      state: state(company.state),
      enabled: Boolean(company.enabled),
      version: count(company.version),
      canApplyFrom: stamp(company.canApplyFrom),
      declineReason: text(company.declineReason),
      checklist: readChecklist(company.checklist),
    },
    member: isObject(value.member) ? readMember(value.member) : null,
  };
}

/** One application in the platform queue. */
function readApplication(value) {
  if (!isObject(value)) throw invalid();
  return {
    id: text(value.id, 64),
    workspaceId: text(value.workspaceId, 200),
    company: text(value.company, 120),
    accountType: text(value.accountType, 40),
    companyCreatedAt: stamp(value.companyCreatedAt),
    appliedAt: stamp(value.appliedAt),
    appliedBy: text(value.appliedBy, 120),
    counts: readChecklist(value.counts),
    state: state(value.state),
    decidedAt: stamp(value.decidedAt),
    reason: text(value.reason),
  };
}

/** `{ applications: [...] }`: pending first, then newest first. */
export function readMarketplaceApplications(value) {
  if (!isObject(value) || !Array.isArray(value.applications)) throw invalid();
  const rows = value.applications.map(readApplication);
  return [
    ...rows.filter((row) => row.state === 'pending'),
    ...rows.filter((r) => r.state !== 'pending'),
  ];
}

/**
 * Settings and agreement responses (finance-design §6.2, §14.3–§14.4). Own settings keep only
 * VAT registration and the TRN; the team default split and referral cap are team-only.
 */
import { secondSources } from '../../../lib/finance/commission.js';
import {
  boolean,
  bp,
  id,
  isoDate,
  list,
  object,
  oneOf,
  optional,
  person,
  text,
  version,
} from './financeValues.js';

/** Team settings carry the split; own settings only VAT registration and the TRN. */
export function readSettings(value, team) {
  if (value === null || value === undefined) return null;
  const settings = object(value);
  const own = {
    vatRegistered: boolean(settings.vatRegistered),
    vatRateBp: bp(settings.vatRateBp),
    trn: optional(text)(settings.trn),
  };
  if (!team) return own;
  return {
    version: version(settings.version),
    agentShareBp: bp(settings.agentShareBp),
    secondAgentSource: oneOf(secondSources)(settings.secondAgentSource),
    maxReferralShareBp: bp(settings.maxReferralShareBp),
    ...own,
  };
}

/** `myAgreements` item, or an agreements-list item when `withAgent`. */
export function readAgreement(value, withAgent = false) {
  const agreement = object(value);
  return {
    id: id(agreement.id),
    ...(withAgent ? { agent: person(agreement.agent) } : {}),
    agentShareBp: bp(agreement.agentShareBp),
    effectiveFrom: isoDate(agreement.effectiveFrom),
    effectiveTo: optional(isoDate)(agreement.effectiveTo),
  };
}

const readClosure = (value) =>
  value === null || value === undefined
    ? null
    : { id: id(object(value).id), effectiveTo: optional(isoDate)(value.effectiveTo) };

/** `GET /finance/agreements`, `POST` (with `closed`) and `DELETE` (with `reopened`) bodies. */
export const readAgreementList = (body) =>
  list(object(body).agreements, (row) => readAgreement(row, true), 'id');
export const readAgreementCreated = (body) => ({
  agreement: readAgreement(object(body).agreement, true),
  closed: readClosure(body.closed),
});
export const readAgreementDeleted = (body) => ({
  deleted: id(object(body).deleted),
  reopened: readClosure(body.reopened),
});

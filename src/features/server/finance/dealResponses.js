/**
 * Deal mutation and hand-over responses (finance-design §13 H-F1, M-F2, M-F3; §15.5–§15.6).
 * A hand-over shows the receiver the deal's ID, type, stage and earned state only — never its
 * money. Every reader is strict like `financeModel.js`.
 */
import { dealStages, dealTypes, readCalculation, readDeal } from './dealModel.js';
import {
  allowed,
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
} from './financeValues.js';

export const handoverAllowedKeys = ['accept', 'decline', 'cancel', 'approve'];
export const handoverStatuses = ['pending', 'accepted', 'declined', 'cancelled', 'approved'];

/** One hand-over request view. */
export function readHandover(value) {
  const row = object(value);
  return {
    id: id(row.id),
    dealId: id(row.dealId),
    dealType: oneOf(dealTypes)(row.dealType),
    stage: oneOf(dealStages)(row.stage),
    earned: boolean(row.earned),
    from: person(row.from),
    to: person(row.to),
    referralShareBp: optional(bp)(row.referralShareBp),
    status: oneOf(handoverStatuses)(row.status),
    createdAt: text(row.createdAt),
    /** The agreement recording the offer (agreements design §14); none for older ones. */
    agreementId: optional(id)(row.agreementId),
    allowed: allowed(row.allowed, handoverAllowedKeys),
  };
}

export const readHandovers = (value) => list(value ?? [], readHandover, 'id');

/** `{ deal }` from create, PATCH, split and unearn; `{ deal, warnings }` from earn. */
export function readDealResult(body, team) {
  const payload = object(body);
  return {
    deal: readDeal(payload.deal, team),
    warnings: list(payload.warnings ?? [], text),
  };
}

/** `{ deal, before, after }` from revise: both calculations shaped like the deal's. */
export function readRevised(body, team) {
  const payload = object(body);
  return {
    deal: readDeal(payload.deal, team),
    before: readCalculation(payload.before, team),
    after: readCalculation(payload.after, team),
  };
}

/** `{ handover, entry }`: `entry` is the moved deal when the caller can still see it. */
export function readHandoverResult(body, team) {
  const payload = object(body);
  const entry = payload.entry;
  return {
    handover: readHandover(payload.handover),
    entry: entry === null || entry === undefined ? null : readDeal(entry, team),
  };
}

/** `GET …/earn-preview`: the agreement, the calculation and warnings the earn would record. */
export function readEarnPreview(body, team) {
  const preview = object(object(body).preview);
  const agreement = optional(object)(preview.agreement);
  return {
    earnedOn: isoDate(preview.earnedOn),
    agreement: agreement && { id: id(agreement.id), agentShareBp: bp(agreement.agentShareBp) },
    calculation: readCalculation(preview.calculation, team),
    warnings: list(preview.warnings ?? [], text),
  };
}

/** `GET /finance/assignees`: members who can hold deals (`kind` staff or owner). */
export const readFinanceAssignees = (body) =>
  list(
    object(body).assignees,
    (row) => ({ ...person(row), kind: oneOf(['staff', 'owner'])(row.kind) }),
    'id',
  );

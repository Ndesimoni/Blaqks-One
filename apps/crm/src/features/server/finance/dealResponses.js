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

export const handoverAllowedKeys = [
  'review',
  'accept',
  'decline',
  'cancel',
  'approve',
  'approveAcceptance',
  'rejectAcceptance',
];
/** `pending` and `awaiting_approval` are open; the rest are decided. */
export const handoverStatuses = [
  'pending',
  'awaiting_approval',
  'accepted',
  'declined',
  'cancelled',
  'approved',
];
export const openHandoverStatuses = ['pending', 'awaiting_approval'];

/** `null`, or the chosen approver and when the receiver accepted (agreements design §17). */
function readApproval(value) {
  if (value === null || value === undefined) return null;
  const approval = object(value);
  return { approver: person(approval.approver), acceptedAt: optional(text)(approval.acceptedAt) };
}

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
    /** Offered to the company's Admin: a full hand-over with no approval step. */
    toAdmin: row.toAdmin === true,
    approval: readApproval(row.approval),
    /** The one offer end for both steps; `null` for older offers. */
    expiresAt: optional(text)(row.expiresAt),
    allowed: allowed(row.allowed, handoverAllowedKeys),
  };
}

/** `GET /finance/approvers`: who may approve a hand-over (names and IDs only). */
export const readFinanceApprovers = (body) => list(object(body).approvers, person, 'id');

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

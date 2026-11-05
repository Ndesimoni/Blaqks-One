/**
 * Finance action gating (finance-design §4, §6.1, §7). Refusals read the profile's
 * `financeAccess` and the row's server-computed `allowed`; lock and self-approval rules are
 * never re-derived here. Messages match the server's, and a refused or failed action always
 * keeps the editor's draft.
 */
import { recordUnavailableMessage } from '../records.js';
import { serverMutationFailure } from '../errors.js';
import { financeDeniedMessages } from './financeAccess.js';

export const archivedMessage = 'Archived workspaces are read-only.';
export const reasonMessage = 'A reason of 1 to 500 characters is required.';
export const earnedDealMessage = 'Earned deals can only be changed by your Admin.';
export const approvedEntryMessage = 'Approved records can only be changed by your Admin.';
export const decidedMessage = 'This record has already been decided. Reload to see its status.';
export const selfReviewMessage = 'Another approver must review your own submissions.';
export const holderOnlyMessage =
  "Only the deal's holder can hand it over. Ask your Admin to move it.";
export const pendingHandoverMessage = 'This deal already has a pending hand-over.';
export const handoverDecidedMessage = 'This hand-over is no longer pending.';

/** Each operation's caller grant and, for an existing row, its `allowed` key. */
export const financeOperations = Object.freeze({
  createDeal: { grant: 'create' },
  editDeal: { grant: 'edit', row: 'edit' },
  assignDeal: { grant: 'manage', row: 'assign' },
  handOverDeal: { grant: 'assign', row: 'handOver' },
  reviewHandover: { grant: 'module', row: 'review' },
  acceptHandover: { grant: 'module', row: 'accept' },
  declineHandover: { grant: 'module', row: 'decline' },
  cancelHandover: { grant: 'module', row: 'cancel' },
  approveHandover: { grant: 'manage', row: 'approve' },
  // The chosen approver or the Admin, while the receiver's acceptance waits (agreements §17).
  approveHandoverAcceptance: { grant: 'module', row: 'approveAcceptance' },
  rejectHandoverAcceptance: { grant: 'module', row: 'rejectAcceptance' },
  earnDeal: { grant: 'approve', row: 'earn' },
  splitDeal: { grant: 'manage', row: 'split' },
  reviseDeal: { grant: 'manage', row: 'revise' },
  unearnDeal: { grant: 'manage', row: 'unearn' },
  deleteDeal: { grant: 'manage', row: 'delete' },
  createEntry: { grant: 'create' },
  editEntry: { grant: 'edit', row: 'edit' },
  approveEntry: { grant: 'approve', row: 'approve' },
  rejectEntry: { grant: 'approve', row: 'reject' },
  voidEntry: { grant: 'manage', row: 'void' },
  saveSettings: { grant: 'manage' },
  createAgreement: { grant: 'manage' },
  deleteAgreement: { grant: 'manage' },
});

/** The target-dependent reason a row refuses an operation the caller otherwise holds. */
function rowMessage(operation, row) {
  if (operation === 'editDeal' && row.earnedOn) return earnedDealMessage;
  if (operation === 'editEntry' && ['approved', 'void'].includes(row.status))
    return approvedEntryMessage;
  if (['approveEntry', 'rejectEntry'].includes(operation))
    return row.status === 'pending' ? selfReviewMessage : decidedMessage;
  if (operation === 'earnDeal' && !row.earnedOn) return selfReviewMessage;
  if (operation === 'handOverDeal')
    return row.pendingHandover ? pendingHandoverMessage : holderOnlyMessage;
  if (operation.endsWith('Handover') || operation.endsWith('HandoverAcceptance'))
    return handoverDecidedMessage;
  return financeDeniedMessages[financeOperations[operation].grant];
}

/**
 * Why `operation` is refused for this caller and row, or '' when it may proceed. An unknown
 * operation, missing access or a row without `allowed` always refuses.
 */
export function financeRefusal(access, operation, row = null, readOnly = false) {
  const rule = financeOperations[operation];
  if (!rule || !access || access.scope === 'none') return financeDeniedMessages.module;
  if (readOnly) return archivedMessage;
  // `module` operations need only finance access; the row's `allowed` decides the rest.
  if (rule.grant !== 'module' && access[rule.grant] !== true)
    return financeDeniedMessages[rule.grant];
  if (!rule.row) return '';
  if (!row) return financeDeniedMessages[rule.grant];
  return row.allowed?.[rule.row] === true ? '' : rowMessage(operation, row);
}

/** Reasons are 1–500 characters after trimming, counted like the database does. */
export function reasonError(reason) {
  const size = typeof reason === 'string' ? [...reason.trim()].length : 0;
  return size >= 1 && size <= 500 ? '' : reasonMessage;
}

const failed = (message, extra = {}) => ({
  ok: false,
  message,
  errors: {},
  conflict: false,
  gone: false,
  status: 0,
  ...extra,
});

/**
 * A failed finance request as `{ ok: false, message, errors, conflict, gone, status }`. A 404
 * reads "no longer available"; a version conflict keeps the draft with reload advice.
 */
export function financeFailure(error, editing = true) {
  const status = error?.status ?? 0;
  if (status === 404) return failed(recordUnavailableMessage, { gone: true, status });
  return failed('', { ...serverMutationFailure(error, editing), status });
}

/**
 * Runs one gated request: refuse locally, validate a required reason, call the server, then
 * refresh the overview. Resolves to `{ ok: true, result }` or a failure; only an abort throws.
 */
export async function runFinanceAction(context, operation, row, call, options = {}) {
  const { access, readOnly, refresh } = context;
  const refusal = financeRefusal(access, operation, row, readOnly);
  if (refusal) return failed(refusal);
  if (options.reason !== undefined && reasonError(options.reason))
    return failed(reasonMessage, { errors: { reason: reasonMessage } });
  let result;
  try {
    result = await call();
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (error?.status === 404 || error?.status === 409) await refresh?.().catch(() => {});
    return financeFailure(error, Boolean(row));
  }
  await refresh?.().catch(() => {});
  return { ok: true, result };
}

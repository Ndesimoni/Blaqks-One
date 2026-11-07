/**
 * Performance targets from `GET /performance/targets` (docs/backend-foundation.md). Parsing is
 * strict: anything malformed is refused rather than shown. Fees targets are whole fils.
 */
import { filsToAed, formatAed, parseAed } from '../../../lib/finance/money.js';
import { targetMetrics } from '../../../services/crm/performance.js';

export const MAX_COUNT_TARGET = 1_000_000;
export const MAX_FEES_TARGET = 1_000_000_000_000;
export const countMessage = 'Enter a whole number from 0 to 1,000,000.';
export const feesMessage = 'Enter an AED amount up to AED 10,000,000,000.';

const isWhole = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const maxFor = (metric) => (metric === 'fees' ? MAX_FEES_TARGET : MAX_COUNT_TARGET);

function readTarget(value) {
  const row = value && typeof value === 'object' ? value : {};
  const valid =
    typeof row.id === 'string' &&
    (row.memberId === null || typeof row.memberId === 'string') &&
    targetMetrics.includes(row.metric) &&
    isWhole(row.value, maxFor(row.metric)) &&
    Number.isSafeInteger(row.version) &&
    row.version > 0;
  if (!valid) throw new Error('The server returned an invalid target.');
  return {
    id: row.id,
    memberId: row.memberId,
    metric: row.metric,
    value: row.value,
    version: row.version,
  };
}

/** `{ month, canEdit, targets }`; `canEdit` is true only for the workspace's own Admin. */
export function readTargets(payload) {
  if (!payload || !Array.isArray(payload.targets) || typeof payload.month !== 'string')
    throw new Error('The server returned invalid targets.');
  return {
    month: payload.month,
    canEdit: payload.canEdit === true,
    targets: payload.targets.map(readTarget),
  };
}

export const readSavedTarget = (payload) =>
  payload?.target === null ? null : readTarget(payload?.target);

/** The selection's targets keyed by metric: team targets, or one member's. */
export function targetsFor(targets, selection) {
  if (selection.kind === 'queue') return {};
  const member = selection.kind === 'team' ? null : selection.memberId;
  return Object.fromEntries(
    targets.filter((target) => target.memberId === member).map((target) => [target.metric, target]),
  );
}

/** Replaces or removes the saved target for one member and metric. */
export function mergeTarget(targets, memberId, metric, saved) {
  const rest = targets.filter((row) => !(row.memberId === memberId && row.metric === metric));
  return saved ? [...rest, saved] : rest;
}

/** Draft text → `{ value, error }`; blank is `null` (clear the target). */
export function parseTargetDraft(metric, text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { value: null, error: '' };
  if (metric === 'fees') {
    const parsed = parseAed(trimmed);
    if (parsed.error || parsed.value > MAX_FEES_TARGET) return { value: null, error: feesMessage };
    return parsed;
  }
  const value = /^\d{1,7}$/.test(trimmed.replaceAll(',', ''))
    ? Number(trimmed.replaceAll(',', ''))
    : NaN;
  return isWhole(value, MAX_COUNT_TARGET)
    ? { value, error: '' }
    : { value: null, error: countMessage };
}

const count = new Intl.NumberFormat('en-AE');

/** Display text for a figure: fils as AED, counts grouped. */
export const formatFigure = (metric, value) =>
  metric === 'fees' ? formatAed(value) : count.format(value);

/** Draft text for an existing target. */
export const draftText = (metric, value) =>
  value === null || value === undefined ? '' : metric === 'fees' ? filsToAed(value) : String(value);

/** Whole percentage of the target achieved, or null without a positive target. */
export const progressOf = (actual, target) =>
  target > 0 ? Math.round((actual / target) * 100) : null;

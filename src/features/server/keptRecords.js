/**
 * Read-only keeps of handed-over records (agreements design §18): the sender keeps reading
 * a client or listing that moved with a deal (`handed_over`), and a receiver reads a listing
 * that stayed with the sender because other deals use it (`shared`). The record list sends
 * `kept` as record ID → badge facts; a kept record is never edited, deleted or reassigned.
 */
import { schema } from '../../lib/schema.js';

const invalid = () => new Error('The server returned an invalid record list.');
const text = (value, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid();
  return value;
};

function readBadge(badge) {
  if (!badge || typeof badge !== 'object') throw invalid();
  if (!['handed_over', 'shared'].includes(badge.reason)) throw invalid();
  if (!['full', 'referral'].includes(badge.kind)) throw invalid();
  const share = badge.referralShareBp;
  if ((badge.kind === 'referral') !== Number.isInteger(share)) throw invalid();
  return Object.freeze({
    reason: badge.reason,
    other: Object.freeze({ id: text(badge.other?.id, 64), name: text(badge.other?.name) }),
    dealId: text(badge.dealId, 80),
    kind: badge.kind,
    referralShareBp: badge.kind === 'referral' ? share : null,
    at: text(badge.at, 40),
  });
}

/** `kept` from the record list: a frozen map of record ID → badge. */
export function readKept(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return Object.freeze(
    Object.fromEntries(Object.entries(value).map(([id, badge]) => [id, readBadge(badge)])),
  );
}

/** `entries` with the kept rows of `collections` added back, for the pages that list them. */
export function withKept(entries, keptEntries, collections) {
  const merged = { ...entries };
  for (const name of collections)
    if (keptEntries?.[name]?.length)
      merged[name] = [...(entries[name] || []), ...keptEntries[name]];
  return merged;
}

/** The keep badge of `record` in `collection`, or null when the caller holds it or sees it. */
export function keptBadge(entries, kept, collection, record) {
  if (!record || !kept) return null;
  const key = schema(collection)[0]?.key;
  const entry = entries?.[collection]?.find((row) => row.record[key] === record[key]);
  return (entry && kept[entry.id]) || null;
}

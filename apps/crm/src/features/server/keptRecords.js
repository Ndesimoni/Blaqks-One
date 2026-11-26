/**
 * Read-only keeps (agreements design §18): the sender keeps reading a client or listing that
 * moved with a deal (`handed_over`), a receiver reads a listing that stayed with the sender
 * because other deals use it (`shared`), and a colleague reads a client, listing or contact
 * shared with them (`colleague`, record sharing R1, with no deal facts). The record list
 * sends `kept` as record ID → badge facts; a kept record is never edited, deleted or moved.
 */
import { schema } from '../../lib/schema.js';

const invalid = () => new Error('The server returned an invalid record list.');
const text = (value, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid();
  return value;
};

const blank = (value) => value === null || value === undefined;

/** A colleague's copy carries no deal, kind or share; a deal keep carries all of them. */
function dealFacts(badge) {
  if (badge.reason === 'colleague') {
    if (![badge.dealId, badge.kind, badge.referralShareBp].every(blank)) throw invalid();
    return { dealId: null, kind: null, referralShareBp: null };
  }
  if (!['handed_over', 'shared'].includes(badge.reason)) throw invalid();
  if (!['full', 'referral'].includes(badge.kind)) throw invalid();
  const share = badge.referralShareBp;
  if ((badge.kind === 'referral') !== Number.isInteger(share)) throw invalid();
  return {
    dealId: text(badge.dealId, 80),
    kind: badge.kind,
    referralShareBp: badge.kind === 'referral' ? share : null,
  };
}

function readBadge(badge) {
  if (!badge || typeof badge !== 'object') throw invalid();
  const facts = dealFacts(badge);
  return Object.freeze({
    reason: badge.reason,
    other: Object.freeze({ id: text(badge.other?.id, 64), name: text(badge.other?.name) }),
    ...facts,
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

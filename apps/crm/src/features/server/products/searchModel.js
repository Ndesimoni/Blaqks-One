import { schema } from '../../../lib/schema.js';
import { selectRecords } from '../../../lib/workspace.js';
import { recordTitle, subtitleParts } from '../../records/panel/panelModel.js';

/**
 * What the top bar's search looks through (NAV5): the people and listings this person can
 * see, which Bitrix24's search leads with. Deals and conversations are not loaded on every
 * page, so search never promises them (review findings 23 and 46).
 */
export const SEARCHED = ['Clients', 'Contacts', 'Properties'];
export const MIN_QUERY = 2;

const row = (module, record) => {
  const id = String(record[schema(module)[0].key] ?? '');
  const detail = subtitleParts(module, record, id).join(' · ');
  return { module, record, id, title: recordTitle(record, id), detail };
};

/**
 * Each searched collection's matches for `query`, using the lists' own matching (linked
 * names included), in SEARCHED order; collections without matches are left out.
 */
export function searchWorkspace(data, query, modules = SEARCHED) {
  const text = query.trim();
  if (text.length < MIN_QUERY) return [];
  return modules
    .map((module) => ({
      module,
      hits: selectRecords(data, module, { query: text }).map((record) => row(module, record)),
    }))
    .filter((group) => group.hits.length);
}

/** `text` split around the first case-insensitive match of `query`, for highlighting. */
export function splitMatch(text, query) {
  const needle = query.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return [text, '', ''];
  return [text.slice(0, at), text.slice(at, at + needle.length), text.slice(at + needle.length)];
}

// Content templates for the Twilio stand-in (W1b, docs/whatsapp-design.md §8 and §18):
// `GET /v1/ContentAndApprovals` lists three synthetic templates per account (two approved
// `twilio/text` templates, one pending) unless `POST /test/templates?sid=` replaced them.
import { createHash } from 'node:crypto';

const LIST = '/v1/ContentAndApprovals';

/** A content SID that differs per account and name: `HX` and 32 hex. */
export const templateSid = (sid, name) =>
  `HX${createHash('md5').update(`${sid}:${name}`).digest('hex')}`;

/** The three default templates; tests read their IDs back from the CRM. */
export function defaultTemplates(sid) {
  return [
    {
      name: 'viewing_reminder',
      category: 'UTILITY',
      status: 'approved',
      body: 'Hello {{1}}, this is a reminder of your viewing on {{2}}.',
    },
    {
      name: 'new_listing',
      category: 'MARKETING',
      status: 'approved',
      body: 'A new listing matches your search. Reply to hear more.',
    },
    {
      name: 'price_update',
      category: 'UTILITY',
      status: 'pending',
      body: 'Price of {{1}} changed.',
    },
  ].map((template) => ({ sid: templateSid(sid, template.name), language: 'en', ...template }));
}

function contentView(account, { sid, name, language, category, status, body, type }) {
  return {
    sid,
    account_sid: account,
    friendly_name: name,
    language,
    variables: {},
    types: type ? { [type]: { title: name } } : { 'twilio/text': { body } },
    approval_requests: { name, category, content_type: type ?? 'twilio/text', status },
  };
}

export function createContent(origin) {
  const configured = new Map();
  /** `POST /test/templates?sid=` with a JSON list replaces the account's templates. */
  function set(sid, list) {
    const filled = (list ?? []).map((item) => ({
      language: 'en',
      ...item,
      sid: item.sid ?? templateSid(sid, item.name),
    }));
    configured.set(sid, filled);
  }
  function list(response, url, auth, json) {
    const size = Math.min(Number(url.searchParams.get('PageSize')) || 50, 50);
    const page = Number(url.searchParams.get('Page')) || 0;
    const all = configured.get(auth.sid) ?? defaultTemplates(auth.sid);
    const more = (page + 1) * size < all.length;
    const link = (index) => `${origin}${LIST}?PageSize=${size}&Page=${index}`;
    return json(response, 200, {
      contents: all
        .slice(page * size, (page + 1) * size)
        .map((template) => contentView(auth.sid, template)),
      meta: { page, page_size: size, key: 'contents', next_page_url: more ? link(page + 1) : null },
    });
  }
  return { set, list, path: LIST };
}

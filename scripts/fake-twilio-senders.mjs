// The WhatsApp senders list of the Twilio stand-in (W1a, docs/whatsapp-design.md §16):
// `GET /v2/Channels/Senders?Channel=whatsapp`, paged like Twilio with next-page links.
export const SENDERS = '/v2/Channels/Senders';

/** Four synthetic +999 senders that differ per account; the last is OFFLINE. */
export function defaultSenders(sid) {
  const base = String(parseInt(sid.slice(-7), 16) % 1_000_000).padStart(6, '0');
  return [1, 2, 3, 4].map((index) => ({
    phone: `+99950${base}${index}`,
    status: index === 4 ? 'OFFLINE' : 'ONLINE',
  }));
}

const hex = (seed) =>
  Buffer.from(seed.padEnd(16, '0').slice(0, 16), 'utf8').toString('hex').slice(0, 32);

function senderView(origin, sid, { phone, status }) {
  const id = `XE${hex(`${sid.slice(-8)}${phone.slice(-8)}`)}`;
  return {
    sid: id,
    status,
    sender_id: `whatsapp:${phone}`,
    configuration: { waba_id: 'synthetic-waba' },
    profile: { name: 'Synthetic sender' },
    webhook: { callback_url: null, fallback_url: null, status_callback_url: null },
    url: `${origin}${SENDERS}/${id}`,
  };
}

/** One page of `all`, the account's senders. */
export function sendersList(response, url, origin, all, sid, json) {
  if (url.searchParams.get('Channel') !== 'whatsapp') return json(response, 400, {});
  const size = Math.min(Number(url.searchParams.get('PageSize')) || 50, 50);
  const page = Number(url.searchParams.get('Page')) || 0;
  const senders = all.slice(page * size, (page + 1) * size);
  const more = (page + 1) * size < all.length;
  const link = (index) =>
    `${origin}${SENDERS}?Channel=whatsapp&PageSize=${size}&Page=${index}&PageToken=PT${index}`;
  return json(response, 200, {
    senders: senders.map((sender) => senderView(origin, sid, sender)),
    meta: {
      page,
      page_size: size,
      first_page_url: link(0),
      previous_page_url: page ? link(page - 1) : null,
      url: link(page),
      next_page_url: more ? link(page + 1) : null,
      key: 'senders',
    },
  });
}

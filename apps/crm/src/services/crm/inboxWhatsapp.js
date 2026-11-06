/**
 * WhatsApp in the Inbox (W1b, docs/whatsapp-design.md §18). Replies and Send again use the
 * shared Inbox routes with `{body}` or `{template: {id, variables}}`; a conversation's read
 * carries `conversation.whatsapp` (window, agreement, templates and whether the caller may
 * send). These add the Start message state, Start on WhatsApp and the client's agreement.
 * Start and a record's consent send back `expectedPhone`, the `contact.phone` the start
 * state showed; a changed or missing value is `409 phone_changed` (W1b review M1).
 */
export function inboxWhatsappRoutes({ request, scope }) {
  const whatsapp = (workspace, suffix) => `${scope(workspace)}/inbox/whatsapp${suffix}`;
  const conversation = (workspace, id) =>
    `${scope(workspace)}/inbox/conversations/${encodeURIComponent(id)}`;
  return {
    /** Whether the caller may start on WhatsApp with this record, and with which templates. */
    whatsappStartState: (workspace, { collection, recordId }, signal) =>
      request(
        whatsapp(workspace, `/start?${new URLSearchParams({ collection, recordId }).toString()}`),
        { signal },
      ),
    /** `{collection, recordId, expectedPhone, template: {id, variables}}`, or `body`. */
    startWhatsappConversation: (workspace, body) =>
      request(`${scope(workspace)}/inbox/conversations`, {
        method: 'POST',
        body: { channel: 'whatsapp', ...body },
      }),
    /** `{change: 'agreed', source}`, `{change: 'stopped'}` or `{change: 'restored', reason}`. */
    recordConversationConsent: (workspace, id, body) =>
      request(`${conversation(workspace, id)}/consent`, { method: 'POST', body }),
    /** The same for a record's number, with `expectedPhone`; the reply names `phone`. */
    recordWhatsappConsent: (workspace, { collection, recordId, ...change }) =>
      request(whatsapp(workspace, '/consent'), {
        method: 'POST',
        body: { collection, recordId, ...change },
      }),
  };
}

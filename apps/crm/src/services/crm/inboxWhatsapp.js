/**
 * WhatsApp in the Inbox (W1b, docs/whatsapp-design.md §18). Replies and Send again use the
 * shared Inbox routes with `{body}` or `{template: {id, variables}}`; a conversation's read
 * carries `conversation.whatsapp` (window, agreement, templates and whether the caller may
 * send). These add the Start message state, Start on WhatsApp and the client's agreement.
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
    /** `{collection, recordId, template: {id, variables}}`, or `body` in an open window. */
    startWhatsappConversation: (workspace, body) =>
      request(`${scope(workspace)}/inbox/conversations`, {
        method: 'POST',
        body: { channel: 'whatsapp', ...body },
      }),
    /** `{change: 'agreed', source}`, `{change: 'stopped'}` or `{change: 'restored', reason}`. */
    recordConversationConsent: (workspace, id, body) =>
      request(`${conversation(workspace, id)}/consent`, { method: 'POST', body }),
    /** The same for a record's number, before any conversation exists. */
    recordWhatsappConsent: (workspace, { collection, recordId, ...change }) =>
      request(whatsapp(workspace, '/consent'), {
        method: 'POST',
        body: { collection, recordId, ...change },
      }),
  };
}

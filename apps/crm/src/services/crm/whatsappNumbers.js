/**
 * WhatsApp numbers inside the company's Twilio account (W1a, docs/whatsapp-design.md §16).
 * The Admin gives each member one number from the account's WhatsApp senders (WQ3); the
 * company account itself connects through the generic channel routes in integrations.js.
 */
export function whatsappNumberRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/whatsapp-numbers`;
  return {
    /** The owning Admin reads every active number; staff read only their own. */
    whatsappNumbers: (workspace, signal) => request(base(workspace), { signal }),
    /** The account's WhatsApp senders from Twilio, each marked available or not (Admin). */
    whatsappSenders: (workspace, signal) => request(`${base(workspace)}/senders`, { signal }),
    giveWhatsappNumber: (workspace, memberId, phone) =>
      request(base(workspace), { method: 'POST', body: { memberId, phone } }),
    disconnectWhatsappNumber: (workspace, number) =>
      request(`${base(workspace)}/${encodeURIComponent(number.id)}/disconnect`, {
        method: 'POST',
        body: { expectedVersion: number.version },
      }),
  };
}

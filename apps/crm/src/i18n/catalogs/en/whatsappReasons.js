/**
 * Why WhatsApp cannot send, or why a message failed, in English (W1b, docs/whatsapp-design.md
 * §11 and §18). Keys are `whatsappReasons.<key>`.
 */
export default {
  'refusal.no_grant':
    'You can read this conversation. Sending on WhatsApp needs the WhatsApp permission from your Admin.',
  'refusal.no_number': 'Your Admin gives you a WhatsApp number on Channels before you can send.',
  'refusal.unsupported':
    'This conversation isn’t on a team member’s WhatsApp number, so replies can’t be sent from the CRM. Add an internal note for your team.',
  'refusal.other_number':
    'Sent from {owner}’s number. Only they reply here; start your own conversation from the client’s record.',
  'refusal.other_numberPlain':
    'Sent from a colleague’s number. Only they reply here; start your own conversation from the client’s record.',
  'refusal.number_disconnected':
    'This conversation’s WhatsApp number is disconnected. Start a new conversation from the client’s record.',
  'refusal.account_reconnect':
    'The company’s Twilio account needs reconnecting on Channels before WhatsApp messages can be sent.',
  'refusal.not_sendable': 'This sender is blocked or marked as spam, so nothing can be sent.',
  'refusal.opted_out': 'The client asked to stop messages, so nothing can be sent.',
  'refusal.openChannels': 'Open Channels',
  'failure.outside_window': 'Outside the 24-hour window: send a template',
  'failure.not_on_whatsapp': 'This number cannot receive WhatsApp messages',
  'failure.whatsapp_limited': 'WhatsApp is limiting messages: try later',
  'failure.template_not_delivered': 'WhatsApp did not deliver this template',
  'failure.number_not_set_up': 'Your number is not set up for WhatsApp in Twilio',
  'failure.whatsapp_refused': 'WhatsApp refused this message',
  'failure.not_sendable': 'This sender is blocked or marked as spam',
  'failure.opted_out': 'The client asked to stop messages',
  'failure.no_agreement': 'The client’s agreement is not recorded',
  'failure.sender_unavailable': 'Your WhatsApp number was not available to send',
  'failure.account_reconnect': 'The company’s Twilio account needs reconnecting',
  'failure.template_unavailable': 'This template is no longer approved',
  'failure.rate_limited': 'Twilio is limiting messages: try later',
  'failure.provider_unavailable': 'Twilio could not be reached',
  'failure.provider_unclear': 'Twilio did not confirm this message',
  'again.unknownBody': 'Twilio did not confirm it. Check with the client before sending it again.',
};

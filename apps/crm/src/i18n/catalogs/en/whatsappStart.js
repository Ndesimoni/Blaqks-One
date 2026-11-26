/** Start message on WhatsApp in English (W1b, docs/i18n.md). Keys are `whatsappStart.<key>`. */
export default {
  title: 'New WhatsApp message',
  channels: 'Send by',
  email: 'Email',
  whatsapp: 'WhatsApp',
  loading: 'Checking WhatsApp for this client…',
  loadError: 'The WhatsApp details could not be loaded.',
  retry: 'Try again',
  from: 'From',
  to: 'To',
  noNumber: 'No WhatsApp number yet',
  noPhone: 'No valid mobile number',
  existing:
    'You already have a WhatsApp conversation with {name}. A template sent here continues it.',
  open: 'Open conversation',
  sent: 'WhatsApp template sent to {name}. It’s in your Client inbox.',
  failed: 'The template could not be sent: {reason}',
  phoneChanged: 'The client’s number changed. Check it and try again.',
  'refusal.no_grant': 'Sending on WhatsApp needs the WhatsApp permission from your Admin.',
  'refusal.no_number': 'Your Admin gives you a WhatsApp number on Channels.',
  'refusal.no_numberAdmin': 'Give yourself a WhatsApp number on Channels → WhatsApp first.',
  'refusal.account_reconnect':
    'The company’s Twilio account needs reconnecting on Channels before you can send.',
  'refusal.no_phone':
    'Add the client’s mobile number in international form (+ or 00) to message them on WhatsApp.',
  'refusal.blocked': 'This number is blocked in the Client inbox, so nothing can be sent.',
  'refusal.opted_out': 'This client asked to stop messages, so nothing can be sent.',
  'refusal.no_agreement':
    'Templates need the client’s agreement. Record how they agreed before sending one.',
  'refusal.conversation_held':
    'A colleague holds this client’s conversation on your number. Ask your Admin to reassign it to you.',
  openChannels: 'Open Channels',
};

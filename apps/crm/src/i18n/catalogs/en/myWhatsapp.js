/** Settings → My WhatsApp in English (docs/whatsapp-design.md §16). Keys are `myWhatsapp.<key>`. */
export default {
  title: 'My WhatsApp',
  description: "Your own WhatsApp number from the company's Twilio account.",
  loading: 'Loading your WhatsApp number…',
  loadFailed: 'Your WhatsApp number could not be loaded.',
  retry: 'Try again',
  noAccess:
    'Your Admin has not turned on WhatsApp for you. Ask them to give you WhatsApp access in Team & access.',
  cardTitle: 'Your WhatsApp number',
  provider: "From the company's Twilio account",
  'badge.ready': 'Connected',
  'badge.none': 'No number yet',
  label: 'Your number',
  since: 'Connected {date}',
  what: 'This is the number the CRM uses for your WhatsApp conversations with clients.',
  work: "The company's Twilio account keeps a log of every message to this number, so keep personal chats off it.",
  none: "Your Admin gives you a WhatsApp number from the company's Twilio account.",
  adminNone: "Give yourself a number under Members' numbers on Channels.",
  openChannels: 'Open Channels',
  disconnect: 'Disconnect',
  'disconnect.title': 'Disconnect your WhatsApp number?',
  'disconnect.body':
    'Client messages to this number stop reaching you in the CRM. Past conversations stay. Only your Admin can give you a number again.',
  'disconnect.adminBody':
    'Client messages to this number stop reaching you in the CRM. Past conversations stay. You can give it back to yourself on Channels.',
  'disconnect.confirm': 'Disconnect number',
  'disconnect.cancel': 'Keep it connected',
  'disconnect.done': 'Your WhatsApp number is disconnected.',
  failed: 'The number could not be disconnected. Try again.',
};

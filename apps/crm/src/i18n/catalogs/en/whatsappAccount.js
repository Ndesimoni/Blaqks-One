/** The company's Twilio account on Channels, in English. Keys are `whatsappAccount.<key>`. */
export default {
  defaultLabel: 'Company WhatsApp',
  where: 'Find these in your Twilio Console under Account info.',
  log: 'Twilio keeps a log of every message to and from the numbers in this account. Ask members to use work numbers, not personal ones.',
  sid: 'Account SID',
  sidHint: 'Starts with AC, followed by 32 letters and numbers.',
  token: 'Auth Token',
  newToken: 'New Auth Token',
  tokenHint: 'Stored encrypted and never shown again.',
  reconnectHint:
    'Paste the current Auth Token from your Twilio Console. It must open the same account.',
  show: 'Show Auth Token',
  hide: 'Hide Auth Token',
  labelRequired: 'Add a display label.',
  sidRequired: 'Add the Account SID.',
  sidInvalid: 'Enter the Account SID as Twilio shows it: AC followed by 32 letters and numbers.',
  tokenRequired: 'Add the Auth Token.',
  tokenInvalid: 'Enter the 32-character Auth Token as Twilio shows it.',
  connectAction: 'Connect Twilio',
  reconnectAction: 'Save new token',
  account: 'Twilio · Account SID ending {hint}',
  tokenSaved: 'Auth Token saved {date}',
  attention: 'Twilio no longer accepts the saved Auth Token. Reconnect with the current token.',
  disconnectBody:
    "Every member's WhatsApp number disconnects too, and WhatsApp stops in the CRM. Past conversations stay. To use WhatsApp again, connect the account and give each number again.",
  failed: 'Twilio could not be reached. Try again.',
};

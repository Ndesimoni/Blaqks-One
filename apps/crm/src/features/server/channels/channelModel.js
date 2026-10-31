/** The channels the Inbox supports and the provider each one uses. */
export const CHANNELS = [
  { channel: 'whatsapp', provider: 'twilio', icon: 'chat' },
  { channel: 'email', provider: null, icon: 'note' },
  { channel: 'facebook', provider: 'meta', icon: 'users' },
  { channel: 'instagram', provider: 'meta', icon: 'image' },
  { channel: 'tiktok', provider: 'tiktok', icon: 'smartphone' },
];

// Company email through SendGrid (E3) comes first. Google mailboxes connect only through
// each member's Google sign-in on My mailbox (E1a); the Microsoft stub stays until its
// adapter lands.
export const EMAIL_PROVIDERS = ['sendgrid', 'microsoft'];

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A plain domain such as `keyswithsimoni.com`; SendGrid itself proves it is authenticated. */
export const validDomain = (value) => DOMAIN.test(value.trim().toLowerCase());

/** The text keys a connection's form uses, so SendGrid asks for a domain and an API key. */
export function fieldKeys(provider) {
  const sendgrid = provider === 'sendgrid';
  return {
    account: sendgrid ? 'channels.sendgrid.domain' : 'channels.account',
    accountHint: sendgrid ? 'channels.sendgrid.domainHint' : '',
    credential: sendgrid ? 'channels.sendgrid.key' : 'channels.credential',
    credentialHint: sendgrid ? 'channels.sendgrid.keyHint' : 'channels.credentialHint',
  };
}

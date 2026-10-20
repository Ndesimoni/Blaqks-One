/** The channels the Inbox supports and the provider each one uses. */
export const CHANNELS = [
  { channel: 'whatsapp', provider: 'twilio', icon: 'chat' },
  { channel: 'email', provider: null, icon: 'note' },
  { channel: 'facebook', provider: 'meta', icon: 'users' },
  { channel: 'instagram', provider: 'meta', icon: 'image' },
  { channel: 'tiktok', provider: 'tiktok', icon: 'smartphone' },
];

// Google mailboxes connect only through Google sign-in (E1a); the typed form keeps the
// Microsoft stub until its adapter lands.
export const EMAIL_PROVIDERS = ['microsoft'];

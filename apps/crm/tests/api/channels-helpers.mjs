/** Shared fixtures for the channel-connection API suite (packet X1). */
import { randomBytes } from 'node:crypto';

export const channelPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/channels${suffix}`;

/**
 * A synthetic Twilio Account SID for the loopback stand-in (scripts/fake-twilio.mjs): `AC`
 * and 32 lower-case hex, random per call. `ending` fixes its last characters; the default
 * never ends in `dead`, which the stand-in treats as a suspended account.
 */
export const twilioSid = (ending = '0') =>
  `AC${randomBytes(16)
    .toString('hex')
    .slice(0, 32 - ending.length)}${ending}`;

/** A synthetic Auth Token: 32 hex that never starts `0000` (the stand-in refuses those). */
export const twilioToken = () => `a${randomBytes(16).toString('hex').slice(1)}`;

/** A WhatsApp connection through the company's Twilio account, unless overridden. */
export const connection = (overrides = {}) => ({
  channel: 'whatsapp',
  provider: 'twilio',
  label: 'Synthetic studio line',
  externalAccountId: twilioSid(),
  credential: twilioToken(),
  ...overrides,
});

export const connect = (session, overrides = {}) =>
  session.request(channelPath(session), {
    method: 'POST',
    body: { connection: connection(overrides) },
  });

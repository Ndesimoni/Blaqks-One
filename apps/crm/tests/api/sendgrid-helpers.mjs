/** Company email through the loopback SendGrid stand-in (scripts/fake-sendgrid.mjs, E3a). */
import { channelPath } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { changeLimitOk } from './team-limit-helpers.mjs';

/** A fresh company, so the shared fixtures' Google mailboxes never meet SendGrid. */
export async function freshAdmin(prefix) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const invited = await invite(owner, prefix, { accountRole: 'admin', positions: [] });
  const admin = await activate(invited);
  await changeLimitOk(owner, admin, 10);
  return admin;
}

/** A synthetic key the stand-in understands: `ok`, `broad`, `narrow`, `pending` or `down`. */
export const sendgridKey = (domain, kind = 'ok') => `SG.${kind}.${domain}`;

export const connectSendgrid = (admin, domain, credential = sendgridKey(domain)) =>
  admin.request(channelPath(admin), {
    method: 'POST',
    body: {
      connection: {
        channel: 'email',
        provider: 'sendgrid',
        label: 'Company email',
        externalAccountId: domain,
        credential,
      },
    },
  });

export const addressesPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/email-addresses${suffix}`;

export const addAddress = (admin, memberId, localPart, displayName = 'Synthetic Agent') =>
  admin.request(addressesPath(admin), {
    method: 'POST',
    body: { address: { memberId, localPart, displayName } },
  });

export const listAddresses = async (session) =>
  (await session.request(addressesPath(session))).value;

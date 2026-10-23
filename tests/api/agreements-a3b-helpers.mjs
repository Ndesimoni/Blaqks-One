import assert from 'node:assert/strict';
import { agreementPath, command, sentAgreement, terms } from './agreements-helpers.mjs';

export { agreementPath, command, terms };
export const detail = async (session, id) => {
  const result = await session.request(agreementPath(session, `/${id}`));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
};

export async function act(session, id, name, body = {}) {
  const current = await detail(session, id);
  return command(session, id, name, { expectedVersion: current.agreement.version, ...body });
}

export function ok(response, status = 200) {
  assert.equal(response.status, status, JSON.stringify(response.value));
  return response.value;
}

export const referralTerms = (amountFils = 10000, senderShareBp = 2500) =>
  terms({ money: { ...terms().money, amountFils, senderShareBp } });

export async function accepted(sender, recipient, body = {}) {
  const id = await sentAgreement(sender, recipient, body);
  ok(await command(recipient, id, 'accept', { expectedVersion: 2 }));
  return id;
}

export const payments = async (session, id) =>
  ok(await session.request(agreementPath(session, `/${id}/payments`)));

export const paidOn = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());

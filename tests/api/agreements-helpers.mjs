/** Shared fixtures for the agreement API suites (docs/agreements-design.md). */
export function terms(overrides = {}) {
  return {
    property: {
      emirate: 'Dubai',
      area: 'Dubai Marina',
      propertyType: 'Apartment',
      bedrooms: 2,
      sizeSqft: 1100,
      askingPriceFils: 210000000,
      listingRef: 'AG-100',
    },
    client: { displayName: 'Synthetic A.', contact: null },
    money: {
      basis: 'commission',
      amountFils: 5250000,
      senderShareBp: 0,
      paymentExpectation: 'on_transfer',
    },
    expiresAt: null,
    governingEmirate: 'Dubai',
    notes: null,
    ...overrides,
  };
}

export const agreementPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/agreements${suffix}`;

export function createAgreement(session, target, body = {}) {
  return session.request(agreementPath(session), {
    method: 'POST',
    body: {
      agreement: {
        kind: body.kind ?? 'handover_full',
        recipient: { workspaceId: target.user.workspaceId, memberId: target.user.id },
        terms: body.terms ?? terms(),
      },
    },
  });
}

export const command = (session, id, name, body) =>
  session.request(agreementPath(session, `/${id}/${name}`), { method: 'POST', body });

/** A draft from `sender` to `recipient`, sent; returns its ID (now at version 2). */
export async function sentAgreement(sender, recipient, body) {
  const created = await createAgreement(sender, recipient, body);
  if (created.status !== 201) throw Error(JSON.stringify(created.value));
  const id = created.value.agreement.id;
  const sent = await command(sender, id, 'send', { expectedVersion: 1 });
  if (sent.status !== 200) throw Error(JSON.stringify(sent.value));
  return id;
}

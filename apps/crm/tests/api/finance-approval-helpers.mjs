import assert from 'node:assert/strict';
import { activate, findMember, invite } from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';
import { day, financePath } from './finance-helpers.mjs';
import { createDeal, dealTeams, earnDeal, heldClient } from './finance-deals-helpers.mjs';

export const ENTRY = {
  locked: 'Approved records can only be changed by your Admin.',
  fixed: "A payment's deal and record IDs cannot be changed.",
  own: 'Another approver must review your own submissions.',
  future: 'Payment and expense dates cannot be in the future.',
  decided: 'This record has already been decided. Reload to see its status.',
  over: "Approving this payment would exceed the deal's fee.",
  notEarned: 'Payments can be recorded once the deal is earned.',
  voided: 'Voided records cannot be changed.',
  notApproved: 'Only approved records can be voided.',
  stale: 'This record changed. Reload before saving.',
  money: 'Amounts must be whole fils between AED 0.01 and AED 10,000,000,000.',
  receipt: 'Enter a valid HTTPS receipt link.',
  issued: 'Record IDs are issued by the server.',
  forYourself: 'Expenses are recorded for yourself.',
  dealMissing: 'The linked deal is missing from this workspace. Choose another deal or clear it.',
  reason: 'A reason of 1 to 500 characters is required.',
  approve: "Your access doesn't include approving finance records.",
  manage: 'Only your Admin can change finance settings.',
  create: "Your access doesn't include adding these records.",
  edit: "Your access doesn't include editing these records.",
  ineligible: 'Choose an active team member with finance access.',
  payment: 'Provide valid payment details.',
  expense: 'Provide valid expense details.',
  versionOnly: 'Provide the record version.',
  versionReason: 'Provide a version and a reason.',
  missing: { message: 'Record not found.', code: 'not_found' },
};

export const KEY = { payments: 'payment', expenses: 'expense' };

export const entryPath = (admin, kind, suffix = '') => financePath(admin, `/${kind}${suffix}`);

export const paymentBody = (dealId, changes = {}) => ({
  dealId,
  receiptDate: day(0),
  amountFils: 1_000_000,
  ...changes,
});

export const expenseBody = (changes = {}) => ({
  datePaid: day(-1),
  amountFils: 150_000,
  category: 'Marketing',
  supplier: 'Synthetic Print Co',
  ...changes,
});

/** Submits a payment or expense as `session`; asserts 201 and returns the view. */
export async function submit(session, admin, kind, body) {
  const result = await session.request(entryPath(admin, kind), {
    method: 'POST',
    body: { [KEY[kind]]: body },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value[KEY[kind]];
}

/** `verdict`: approve, reject or void. */
export const decide = (session, admin, kind, entry, verdict, body = {}) =>
  session.request(entryPath(admin, kind, `/${entry.id}/${verdict}`), {
    method: 'POST',
    body: { version: entry.version, ...body },
  });

export const edit = (session, admin, kind, entry, fields, extra = {}) =>
  session.request(entryPath(admin, kind, `/${entry.id}`), {
    method: 'PATCH',
    body: { [KEY[kind]]: fields, version: entry.version, ...extra },
  });

/** Decides and asserts 200, returning the new view. */
export async function decided(session, admin, kind, entry, verdict, body) {
  const result = await decide(session, admin, kind, entry, verdict, body);
  assert.equal(result.status, 200, `${verdict} ${JSON.stringify(result.value)}`);
  return result.value[KEY[kind]];
}

/** The editable fields of a payment view. */
export const paymentFields = (payment, changes = {}) => ({
  receiptDate: payment.receiptDate,
  amountFils: payment.amountFils,
  reference: payment.reference,
  notes: payment.notes,
  ...changes,
});

/** The editable fields of an expense view. */
export const expenseFields = (expense, changes = {}) => ({
  datePaid: expense.datePaid,
  amountFils: expense.amountFils,
  category: expense.category,
  supplier: expense.supplier,
  campaignReference: expense.campaignReference,
  propertyId: expense.propertyId,
  receiptUrl: expense.receiptUrl,
  notes: expense.notes,
  ...changes,
});

/**
 * dealTeams plus a second approver and one earned G1 deal held by the agent
 * (net 4,900,000 fils, VAT registered; agreement 60% when `agreement` is set).
 */
export async function approvalTeams(prefix, { agreement = false, settings = {} } = {}) {
  const teams = await dealTeams(prefix, settings);
  const { admin, agent } = teams;
  const positions = ['accountant'];
  const invited = await activate(await invite(admin, `${prefix}-approver2`, { positions }));
  const member = await findMember(admin, invited.user.id);
  const actions = { ...member.actions, finance: FINANCE.all };
  const approver2 = await grant(admin, invited, { recordScope: 'team', actions });
  if (agreement) {
    const created = await admin.request(financePath(admin, '/agreements'), {
      method: 'POST',
      body: { agentId: agent.user.id, agentShareBp: 6000, effectiveFrom: day(-200) },
    });
    assert.equal(created.status, 201, JSON.stringify(created.value));
  }
  const client = await heldClient(agent);
  const deal = await earnDeal(admin, await createDeal(agent, client));
  return { ...teams, approver2, client, deal };
}

/**
 * Finance routes under `/api/crm/workspaces/{ws}/finance` (finance-design §6, §14). They share
 * the CRM client's same-origin request, cookie session and in-memory CSRF token, like
 * `assignments.js`: spread `financeRoutes({ request, scope })` into `createCrmClient`.
 * Bodies are built from allowlists because the server refuses unknown keys; money is sent as
 * integer fils and shares as basis points, never as AED decimals.
 */
import { financeDealRoutes, pick, segment } from './financeDeals.js';

const settingsKeys = ['agentShareBp', 'secondAgentSource', 'maxReferralShareBp', 'vatRegistered'];
const paymentKeys = ['dealId', 'receiptDate', 'amountFils', 'reference', 'notes'];
const expenseKeys = [
  'datePaid',
  'category',
  'supplier',
  'campaignReference',
  'propertyId',
  'amountFils',
  'receiptUrl',
  'notes',
  'incurredBy',
];
/** Entry kinds: the URL segment and the body key. A payment's deal is fixed after create. */
const entries = {
  payments: { body: 'payment', create: paymentKeys, update: paymentKeys.slice(1) },
  expenses: { body: 'expense', create: expenseKeys, update: expenseKeys },
};
const kind = (name) => {
  if (!entries[name]) throw new Error('Choose payments or expenses.');
  return entries[name];
};
const withReason = (body, reason) => (reason === undefined ? body : { ...body, reason });

export function financeRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/finance`;
  const send = (path, method, body) => request(path, { method, body });
  /** Implemented by the server today (B2): overview, settings and agreements. */
  const available = {
    financeOverview: (workspace, { agent } = {}, signal) =>
      request(`${base(workspace)}${agent ? `?agent=${segment(agent)}` : ''}`, { signal }),
    saveFinanceSettings: (workspace, settings) =>
      send(`${base(workspace)}/settings`, 'PUT', {
        version: settings.version ?? null,
        ...pick(settings, settingsKeys),
        trn: settings.trn || null,
      }),
    financeAgreements: (workspace, agentId, signal) =>
      request(`${base(workspace)}/agreements${agentId ? `?agentId=${segment(agentId)}` : ''}`, {
        signal,
      }),
    createAgreement: (workspace, agreement) =>
      send(
        `${base(workspace)}/agreements`,
        'POST',
        pick(agreement, ['agentId', 'agentShareBp', 'effectiveFrom']),
      ),
    deleteAgreement: (workspace, id) =>
      send(`${base(workspace)}/agreements/${segment(id)}`, 'DELETE'),
  };
  return { ...available, ...financeRecordRoutes(base, send, request) };
}

/**
 * Deals and hand-overs (B3, `financeDeals.js`) plus payments/expenses (B4) from the frozen
 * contract (§6.2, §13). Payments, expenses and history are not served yet; callers receive the
 * server's 404 until B4 lands. `metadata` is the parsed view's `{ id, version }`.
 */
function financeRecordRoutes(base, send, request) {
  const entry = (workspace, name, metadata, action = '') =>
    `${base(workspace)}/${name}/${segment(metadata.id)}${action}`;
  return {
    ...financeDealRoutes(base, send, request),
    financeHistory: (workspace, name, id, signal) => {
      if (name !== 'deals') kind(name);
      return request(`${base(workspace)}/${name}/${segment(id)}/history`, { signal });
    },
    createEntry: (workspace, name, draft) =>
      send(`${base(workspace)}/${name}`, 'POST', {
        [kind(name).body]: pick(draft, kind(name).create),
      }),
    updateEntry: (workspace, name, metadata, draft, reason) =>
      send(
        entry(workspace, name, metadata),
        'PATCH',
        withReason(
          { [kind(name).body]: pick(draft, kind(name).update), version: metadata.version },
          reason,
        ),
      ),
    /** `decision` is approve, reject or void; reject and void need a reason. */
    decideEntry: (workspace, name, metadata, decision, reason) => {
      if (!['approve', 'reject', 'void'].includes(decision)) throw new Error('Unknown decision.');
      kind(name);
      return send(
        entry(workspace, name, metadata, `/${decision}`),
        'POST',
        withReason({ version: metadata.version }, decision === 'approve' ? undefined : reason),
      );
    },
  };
}

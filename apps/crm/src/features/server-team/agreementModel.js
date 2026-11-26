/**
 * Per-agent commission agreements (finance-design §6.2, §13 M-F3, §14.4). An agreement runs
 * from `effectiveFrom` until the day the next one starts (`effectiveTo`, exclusive) or stays
 * open. Adding one auto-closes the open agreement; deleting a future one reopens it.
 */
import { formatPercent, parsePercent } from '../../lib/finance/money.js';

export const agreementMessages = {
  agentId: 'Choose a team member.',
  share: "Enter the agent's share, such as 60.",
  effectiveFrom: 'Enter a valid date (YYYY-MM-DD).',
};
export const statusLabels = { current: 'In force', future: 'Future', closed: 'Closed' };
export const statusTones = { current: 'green', future: 'amber', closed: 'slate' };

/** Asia/Dubai calendar date (YYYY-MM-DD), the business day the server uses. */
export const dubaiToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(now);

export const blankAgreement = (agentId = '') => ({ agentId, share: '', effectiveFrom: '' });

const validDate = (text) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

/** Field errors for the agreement editor; empty when the draft can be sent. */
export function agreementErrors(draft, agents) {
  const { value, error } = parsePercent(draft.share);
  const errors = {
    agentId: agents.some((agent) => agent.id === draft.agentId) ? '' : agreementMessages.agentId,
    share: error || (value === null ? agreementMessages.share : ''),
    effectiveFrom: validDate(draft.effectiveFrom) ? '' : agreementMessages.effectiveFrom,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

export const agreementBody = (draft) => ({
  agentId: draft.agentId,
  agentShareBp: parsePercent(draft.share).value,
  effectiveFrom: draft.effectiveFrom,
});

/** In force, future or closed on `today`. */
export function agreementStatus(agreement, today) {
  if (agreement.effectiveFrom > today) return 'future';
  if (agreement.effectiveTo && agreement.effectiveTo <= today) return 'closed';
  return 'current';
}

/** Plain-language period: "From 2026-01-01" and, when replaced, "until 2026-05-01". */
export const periodText = (agreement) =>
  agreement.effectiveTo
    ? `From ${agreement.effectiveFrom}, replaced on ${agreement.effectiveTo}`
    : `From ${agreement.effectiveFrom}, no end date`;

/** Agreements grouped per agent (name order), newest first within each agent. */
export function agreementTimelines(agreements) {
  const groups = new Map();
  for (const agreement of agreements) {
    const group = groups.get(agreement.agent.id) ?? { agent: agreement.agent, agreements: [] };
    group.agreements.push(agreement);
    groups.set(agreement.agent.id, group);
  }
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      agreements: group.agreements.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    }))
    .sort((a, b) => collator.compare(a.agent.name, b.agent.name));
}

/** The open-ended agreement a new one for `agentId` would close, or null. */
export const openAgreement = (agreements, agentId) =>
  agreements.find((item) => item.agent.id === agentId && !item.effectiveTo) ?? null;

/** What adding the draft will do to the open agreement, for the editor's notice. */
export function closingNotice(agreements, draft) {
  const open = openAgreement(agreements, draft.agentId);
  if (!open) return 'This will be their first agreement. The team default applies until it starts.';
  const ends = validDate(draft.effectiveFrom) ? draft.effectiveFrom : 'the new start date';
  return `Their open agreement (${formatPercent(open.agentShareBp)} from ${open.effectiveFrom}) will close automatically on ${ends}.`;
}

/** Team staff who can hold an agreement: current (non-archived) staff accounts. */
export const agreementAgents = (members) =>
  members
    .filter((member) => member.roleId === 'staff' && member.status !== 'archived')
    .filter((member) => !member.deletedAt)
    .map((member) => ({ id: member.id, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

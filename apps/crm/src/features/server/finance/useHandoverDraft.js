import { useState } from 'react';
import { parsePercent } from '../../../lib/finance/money.js';
import { useFinanceApprovers, useFinanceContext } from './useFinanceRequests.js';

const overCapMessage = "The referral share is above your team's limit.";

/**
 * The hand-over form's draft (finance-design §13 H-F1; agreements design §17): the receiver
 * (a teammate or the company's Admin), a full hand-over or a referral share, and for a
 * staff-to-staff offer an optional approver. An offer to the Admin is always full and needs
 * no approval. The server checks the receiver, the share and the approver again.
 */
export function useHandoverDraft(deal) {
  const { api, workspaceId, assignees, user, team, overview } = useFinanceContext();
  const [toId, setToId] = useState('');
  const [mode, setMode] = useState('full');
  const [share, setShare] = useState('');
  const [needed, setNeeded] = useState(false);
  const [pick, setPick] = useState('');
  const people = assignees.people.filter(
    (person) => ['staff', 'owner'].includes(person.kind) && person.id !== user.id,
  );
  const receiver = people.find((person) => person.id === toId) ?? null;
  const toAdmin = receiver?.kind === 'owner';
  const approvalOffered = user.roleId === 'staff' && !toAdmin;
  const needsApproval = approvalOffered && needed;
  const approvers = useFinanceApprovers(api, workspaceId, needsApproval);
  // The Admin approves by default; the receiver never approves their own hand-over.
  const candidates = approvers.people.filter((person) => person.id !== toId);
  const ownerId = assignees.people.find((person) => person.kind === 'owner')?.id ?? '';
  const choice = pick || ownerId;
  const approver = (needsApproval && candidates.find((person) => person.id === choice)) || null;
  const referralAllowed = !deal.earnedOn && !deal.secondAgent && !toAdmin;
  const keep = mode === 'referral' && referralAllowed;
  const cap = team ? overview.settings?.maxReferralShareBp : null;
  const parsed = parsePercent(share);
  const shareError =
    keep && (parsed.error || (parsed.value === null ? 'Enter the referral share.' : ''));
  const overCap = keep && cap !== null && cap !== undefined && parsed.value > cap;
  return {
    people,
    toId,
    setToId,
    receiver,
    toAdmin,
    keep,
    setMode,
    share,
    setShare,
    referralAllowed,
    cap,
    shareError: shareError || (overCap ? overCapMessage : ''),
    approvalOffered,
    needsApproval,
    setNeeded,
    approvers: { ...approvers, people: candidates },
    approver,
    setApprover: setPick,
    referralShareBp: keep ? parsed.value : null,
    ready: Boolean(receiver) && !shareError && !overCap && (!needsApproval || Boolean(approver)),
  };
}

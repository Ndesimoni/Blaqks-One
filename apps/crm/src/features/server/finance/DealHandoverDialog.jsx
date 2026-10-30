import React, { useId, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';
import { DealRecord } from './DealRecord.jsx';
import { HandoverApproverFields } from './HandoverApproverFields.jsx';
import { HandoverShareFields } from './HandoverShareFields.jsx';
import { useHandoverDraft } from './useHandoverDraft.js';

/** What happens after the offer is accepted, in one or more short sentences. */
function outcome(draft, team, k) {
  const name = draft.receiver.name;
  const first = draft.toAdmin
    ? k('outcomeAdmin', { name })
    : draft.approver
      ? k('outcomeApproval', { name, approver: draft.approver.name })
      : k('outcome', { name });
  return [first, team ? '' : k('leavesList'), draft.keep ? k('referralNote') : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * The holder offers their deal to a teammate or the company's Admin (finance-design §13
 * H-F1; agreements design §17): fully, or keeping a referral share that becomes a second-agent
 * line from the receiver's share. An offer to the Admin is always full. A staff-to-staff offer
 * may need approval by a chosen approver after the receiver accepts. Nothing moves until then;
 * the team's referral limit is checked by the server. Offers to other companies are made in
 * Agreements.
 */
export function DealHandoverDialog({ deal, onClose, onDone }) {
  const { actions, assignees, team } = useFinanceContext();
  const { t } = useI18n();
  const k = (key, vars) => t(`handoverRequests.form.${key}`, vars);
  const id = useId();
  const draft = useHandoverDraft(deal);
  const [message, setMessage] = useState('');
  const edit = (setter) => (value) => {
    setter(value);
    setMessage('');
  };
  const submit = async () => {
    setMessage('');
    const result = await actions.requestHandover(
      deal,
      draft.toId,
      draft.referralShareBp,
      draft.approver?.id ?? null,
    );
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Hand over deal"
      intro="The deal moves only after your teammate accepts. You can cancel the request until then."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Send hand-over request"
      submitDisabled={!draft.ready}
    >
      <DealRecord deal={deal} />
      {assignees.error && (
        <p className="field-error" role="alert">
          {assignees.error}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-to`}>
          Hand over to<span className="required"> *</span>
        </label>
        <select
          id={`${id}-to`}
          value={draft.toId}
          disabled={assignees.loading}
          onChange={(event) => edit(draft.setToId)(event.target.value)}
        >
          <option value="">
            {assignees.loading ? 'Loading team members…' : 'Choose a teammate'}
          </option>
          {draft.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.kind === 'owner' ? k('adminOption', { name: person.name }) : person.name}
            </option>
          ))}
        </select>
        {!assignees.loading && !assignees.error && !draft.people.length && (
          <p className="field-error" role="alert">
            {t('handoverOffer.noTeammates')}
          </p>
        )}
        <small className="finance-hint">{t('handoverOffer.otherCompany')}</small>
      </div>
      <HandoverShareFields
        id={id}
        keep={draft.keep}
        setMode={draft.setMode}
        share={draft.share}
        setShare={edit(draft.setShare)}
        allowed={draft.referralAllowed}
        cap={draft.cap}
        error={draft.shareError}
        blockedDetail={draft.toAdmin ? k('adminFull') : undefined}
      />
      {draft.approvalOffered && (
        <HandoverApproverFields
          id={id}
          needed={draft.needsApproval}
          onNeeded={edit(draft.setNeeded)}
          approvers={draft.approvers}
          value={draft.approver?.id ?? ''}
          onChange={edit(draft.setApprover)}
        />
      )}
      {draft.receiver && (
        <p className="finance-note deal-handover-outcome" role="note">
          {outcome(draft, team, k)}
        </p>
      )}
    </FinanceDialog>
  );
}

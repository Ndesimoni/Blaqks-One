import React, { useId, useState } from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { reasonError } from './financeRules.js';
import { holderName } from './dealFilters.js';
import { DealRecord } from './DealRecord.jsx';

/**
 * Admin move (finance-design §13 H-F1): a deal goes to another member or the team queue with
 * a required reason. Moving an earned deal never changes its commission lines.
 */
export function MoveDealDialog({ deal, onClose, onDone }) {
  const { actions, assignees, user } = useFinanceContext();
  const id = useId();
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const toId = choice === 'queue' ? null : choice;
  const unchanged = choice !== '' && toId === (deal.assignee?.id ?? null);
  const submit = async () => {
    setMessage('');
    const result = await actions.assignDeal(deal, toId, reason);
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Move deal"
      intro={`Currently held by ${holderName(deal.assignee, user.id)}.${deal.earnedOn ? ' Earned commission stays with the agents already recorded.' : ''}`}
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Move deal"
      submitDisabled={!choice || unchanged || Boolean(reasonError(reason))}
    >
      <DealRecord deal={deal} />
      {assignees.error && (
        <p className="field-error" role="alert">
          {assignees.error}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-to`}>
          New holder<span className="required"> *</span>
        </label>
        <select
          id={`${id}-to`}
          value={choice}
          disabled={assignees.loading}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">
            {assignees.loading ? 'Loading team members…' : 'Choose a holder'}
          </option>
          {assignees.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.id === user.id ? `${person.name} (you)` : person.name}
            </option>
          ))}
          <option value="queue">Team queue</option>
        </select>
        {unchanged && <p className="finance-hint">This is already the current holder.</p>}
      </div>
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
    </FinanceDialog>
  );
}

import React, { useId, useMemo, useState } from 'react';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { readSplitDraft, splitAfter, splitChanged, splitDraftFromDeal } from './splitDraft.js';
import { reasonError } from './financeRules.js';

function Compare({ label, before, after }) {
  return (
    <div className="finance-compare-row">
      <dt>{label}</dt>
      <dd className="finance-money">{formatAed(before)}</dd>
      <dd className="finance-money">{after === undefined ? '—' : formatAed(after)}</dd>
    </div>
  );
}

/**
 * Admin split panel for an unearned deal (finance-design §7): second agent and share, an
 * override of the holder's share, a reason whenever anything changes and a before/after
 * estimate. The draft stays after any refusal.
 */
export function DealSplitDialog({ deal, onClose, onDone }) {
  const { actions, assignees, overview } = useFinanceContext();
  const id = useId();
  const [draft, setDraft] = useState(() => splitDraftFromDeal(deal));
  const [message, setMessage] = useState('');
  const { value, errors } = readSplitDraft(draft);
  const changed = splitChanged(deal, value);
  const reasonIssue = changed && draft.reason && reasonError(draft.reason);
  const kind = value?.secondAgentId === deal.secondAgent?.id ? deal.secondAgent?.kind : 'split';
  const after = useMemo(
    () => splitAfter(deal, overview.settings, value, kind),
    [deal, overview.settings, value, kind],
  );
  const set = (key) => (event) =>
    setDraft((previous) => ({ ...previous, [key]: event.target?.value ?? event }));
  const people = assignees.people.filter(
    (person) => person.kind === 'staff' && person.id !== deal.assignee?.id,
  );
  const before = deal.calculation;
  const beforeLine = (role) => before?.lines.find((line) => line.role === role)?.amountFils ?? 0;
  const submit = async () => {
    if (!value) return;
    const reason = changed ? draft.reason : null;
    const result = await actions.splitDeal(deal, { ...value, reason });
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Change split"
      intro="Set a second agent or adjust the holder's share. The split is fixed when the deal is earned."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Save split"
      submitDisabled={!value || !changed || Boolean(reasonError(draft.reason))}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${id}-agent`}>Second agent</label>
          <select id={`${id}-agent`} value={draft.secondAgentId} onChange={set('secondAgentId')}>
            <option value="">No second agent</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
            {deal.secondAgent && !people.some((person) => person.id === deal.secondAgent.id) && (
              <option value={deal.secondAgent.id}>{deal.secondAgent.name}</option>
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-share`}>Second agent share %</label>
          <input
            id={`${id}-share`}
            inputMode="decimal"
            value={draft.secondShare}
            aria-invalid={Boolean(errors.secondShare)}
            onChange={set('secondShare')}
          />
          {errors.secondShare && <p className="field-error">{errors.secondShare}</p>}
        </div>
        <div className="field">
          <label htmlFor={`${id}-override`}>Holder share override %</label>
          <input
            id={`${id}-override`}
            inputMode="decimal"
            value={draft.override}
            aria-invalid={Boolean(errors.override)}
            aria-describedby={`${id}-override-hint`}
            onChange={set('override')}
          />
          <small id={`${id}-override-hint`} className="finance-hint">
            Leave blank to use the holder's agreement or the team default.
          </small>
          {errors.override && <p className="field-error">{errors.override}</p>}
        </div>
        <ReasonField
          id={`${id}-reason`}
          value={draft.reason}
          onChange={set('reason')}
          error={reasonIssue}
          hint={changed ? 'Required for any change.' : 'Change the split to save.'}
        />
      </div>
      <dl className="finance-compare" aria-label="Split before and after">
        <div className="finance-compare-row head">
          <dt>Estimate</dt>
          <dd>Before</dd>
          <dd>After</dd>
        </div>
        <Compare label="Holder" before={beforeLine('primary')} after={after?.primaryFils} />
        <Compare
          label="Second agent"
          before={beforeLine('second')}
          after={after?.secondFils ?? (after ? 0 : undefined)}
        />
        <Compare
          label="Company share"
          before={before?.companyFils ?? 0}
          after={after?.companyFils}
        />
      </dl>
    </FinanceDialog>
  );
}

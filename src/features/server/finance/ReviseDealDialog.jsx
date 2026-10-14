import React, { useId, useState } from 'react';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { readSplitDraft, splitDraftFromDeal } from './splitDraft.js';
import { reasonError } from './financeRules.js';
import { readRevised } from './dealResponses.js';
import { lineLabel } from './dealFilters.js';

/** Only the fields the Admin changed travel (§15.5); everything else keeps the snapshot's. */
function reviseChanges(deal, value) {
  const changes = {};
  if ((deal.override?.agentShareBp ?? null) !== value.overrideAgentShareBp)
    changes.overrideAgentShareBp = value.overrideAgentShareBp;
  const second = [deal.secondAgent?.id ?? null, deal.secondAgent?.shareBp ?? null];
  if (second[0] !== value.secondAgentId || second[1] !== value.secondAgentShareBp)
    Object.assign(changes, {
      secondAgentId: value.secondAgentId,
      secondAgentShareBp: value.secondAgentShareBp,
    });
  return changes;
}

function Outcome({ result }) {
  const rows = (calc) => [
    ...calc.lines.map((line) => [lineLabel(line, true), line.amountFils]),
    ['Net fee', calc.netFils],
    ['Company share', calc.companyFils],
  ];
  return (
    <div className="finance-revised" role="status">
      <p>Revision {result.after.revision} saved. Earlier figures stay in the deal history.</p>
      <div className="finance-revised-grid">
        {[
          ['Before', result.before],
          ['After', result.after],
        ].map(([label, calc]) => (
          <section key={label} aria-label={`${label} revision`}>
            <h4>{label}</h4>
            <dl className="finance-rows">
              {rows(calc).map(([name, value]) => (
                <div className="finance-row" key={name}>
                  <dt>{name}</dt>
                  <dd className="finance-money">{formatAed(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Admin revision of an earned deal (finance-design §2.4, §13 M-F3): a required reason and
 * optional split changes. The result shows the superseded and new figures side by side.
 */
export function ReviseDealDialog({ deal, onClose, onDone }) {
  const { actions, assignees, team } = useFinanceContext();
  const id = useId();
  const [draft, setDraft] = useState(() => splitDraftFromDeal(deal));
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const { value, errors } = readSplitDraft(draft);
  const set = (key) => (input) =>
    setDraft((previous) => ({ ...previous, [key]: input?.target?.value ?? input }));
  const people = assignees.people.filter(
    (person) => person.kind === 'staff' && person.id !== deal.assignee?.id,
  );
  const submit = async () => {
    if (!value) return;
    setMessage('');
    const outcome = await actions.reviseDeal(deal, draft.reason, reviseChanges(deal, value));
    if (!outcome.ok) return setMessage(failureText(outcome));
    setResult(readRevised(outcome.result, team));
  };
  if (result)
    return (
      <FinanceDialog eyebrow={`DEALS · ${deal.dealId}`} title="Deal revised" onClose={onDone}>
        <Outcome result={result} />
      </FinanceDialog>
    );
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Revise earned deal"
      intro="A revision records new figures and keeps the earlier ones in the history."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Save revision"
      submitDisabled={!value || Boolean(reasonError(draft.reason))}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${id}-agent`}>Second agent</label>
          <select id={`${id}-agent`} value={draft.secondAgentId} onChange={set('secondAgentId')}>
            <option value="">No second agent</option>
            {deal.secondAgent && !people.some((person) => person.id === deal.secondAgent.id) && (
              <option value={deal.secondAgent.id}>{deal.secondAgent.name}</option>
            )}
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-share`}>Second agent share %</label>
          <input
            id={`${id}-share`}
            inputMode="decimal"
            value={draft.secondShare}
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
            onChange={set('override')}
          />
          {errors.override && <p className="field-error">{errors.override}</p>}
        </div>
        <ReasonField id={`${id}-reason`} value={draft.reason} onChange={set('reason')} />
      </div>
    </FinanceDialog>
  );
}

import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { FinanceField } from '../server/finance/FinanceField.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { readAgreementCreated } from '../server/finance/settingsModel.js';
import { agreementBody, agreementErrors, blankAgreement, closingNotice } from './agreementModel.js';

/**
 * Adds a per-agent agreement (finance-design §6.2, §13 M-F3). Adding auto-closes the agent's
 * open agreement on the new start date; server refusals (overlap, earned deals) keep the draft.
 */
export function AgreementEditor({ agents, agreements, actions, onCreated }) {
  const titleId = useId();
  const formRef = useRef(null);
  const [draft, setDraft] = useState(blankAgreement);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const busy = actions.busy;
  const dirty = JSON.stringify(draft) !== JSON.stringify(blankAgreement());
  useUnsavedChanges(dirty, busy, 'Discard the agreement you are adding?');
  useEffect(() => {
    if (focusRequest) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setFailure('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = agreementErrors(draft, agents);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length) return setFocusRequest((value) => value + 1);
    const result = await actions.createAgreement(agreementBody(draft));
    if (!result.ok) return setFailure(result.message);
    try {
      onCreated(readAgreementCreated(result.result));
    } catch (error) {
      return setFailure(error.message);
    }
    setDraft(blankAgreement());
  };
  const input =
    (key, extra = {}) =>
    (props) => (
      <input
        {...props}
        {...extra}
        value={draft[key]}
        disabled={busy}
        onChange={(event) => change(key, event.target.value)}
      />
    );
  return (
    <section className="panel team-finance-panel" aria-labelledby={titleId}>
      <div className="team-finance-heading">
        <h3 id={titleId}>Add an agreement</h3>
        <p>
          Adding an agreement closes the agent&apos;s open agreement on the new start date. It must
          start after their latest agreement and cannot reach back over deals already earned.
        </p>
      </div>
      <form ref={formRef} className="team-finance-form" noValidate onSubmit={submit}>
        <div className="team-finance-grid">
          <FinanceField name="agentId" label="Team member" required error={errors.agentId}>
            {(props) => (
              <select
                {...props}
                value={draft.agentId}
                disabled={busy}
                onChange={(event) => change('agentId', event.target.value)}
              >
                <option value="">Choose a team member</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </FinanceField>
          <FinanceField name="share" label="Agent share (%)" required error={errors.share}>
            {input('share', { inputMode: 'decimal', autoComplete: 'off' })}
          </FinanceField>
          <FinanceField
            name="effectiveFrom"
            label="Starts on"
            required
            error={errors.effectiveFrom}
          >
            {input('effectiveFrom', { type: 'date' })}
          </FinanceField>
        </div>
        {draft.agentId && (
          <p className="team-finance-note" role="note">
            {closingNotice(agreements, draft)}
          </p>
        )}
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="team-finance-actions">
          <Button type="submit" icon="plus" disabled={busy}>
            {busy ? 'Saving…' : 'Add agreement'}
          </Button>
        </div>
      </form>
    </section>
  );
}

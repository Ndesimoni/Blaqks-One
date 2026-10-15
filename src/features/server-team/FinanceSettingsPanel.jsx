import React, { useId } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { FinanceField } from '../server/finance/FinanceField.jsx';
import { formatPercent } from '../../lib/finance/money.js';
import {
  companyShareText,
  DEFAULT_VAT_RATE_BP,
  secondSourceOptions,
} from './financeSettingsForm.js';
import { useFinanceSettingsForm } from './useFinanceSettingsForm.js';

/** Admin-only team commission split, referral limit and VAT registration (finance-design §7). */
export function FinanceSettingsPanel({ settings, actions }) {
  const titleId = useId();
  const form = useFinanceSettingsForm(settings, actions);
  const { draft, errors, change } = form;
  const busy = actions.busy;
  const percentInput = (key) => (props) => (
    <input
      {...props}
      inputMode="decimal"
      autoComplete="off"
      value={draft[key]}
      disabled={busy}
      onChange={(event) => change(key, event.target.value)}
    />
  );
  return (
    <section className="panel team-finance-panel" aria-labelledby={titleId}>
      <div className="team-finance-heading">
        <h3 id={titleId}>Commission split and VAT</h3>
        <p>
          Used when a deal is marked earned. Earned deals keep the figures they were earned with.
        </p>
      </div>
      {!form.base && (
        <p className="team-finance-note" role="note">
          Set up your team&apos;s commission split before marking deals earned.
        </p>
      )}
      <form ref={form.formRef} className="team-finance-form" noValidate onSubmit={form.submit}>
        <div className="team-finance-grid">
          <FinanceField
            name="agentShare"
            label="Agent share (%)"
            required
            hint={`Of the net commission, for agents without their own agreement. ${companyShareText(draft.agentShare)}`}
            error={errors.agentShare}
          >
            {percentInput('agentShare')}
          </FinanceField>
          <FinanceField
            name="maxReferralShare"
            label="Largest referral share (%)"
            required
            hint="The most an agent can keep when handing a deal on. Use 0 for full hand-overs only."
            error={errors.maxReferralShare}
          >
            {percentInput('maxReferralShare')}
          </FinanceField>
        </div>
        <fieldset className="team-finance-choice" disabled={busy}>
          <legend>A second agent&apos;s share comes from</legend>
          {secondSourceOptions.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="secondAgentSource"
                value={value}
                checked={draft.secondAgentSource === value}
                onChange={() => change('secondAgentSource', value)}
              />
              {label}
            </label>
          ))}
          {errors.secondAgentSource && <p className="field-error">{errors.secondAgentSource}</p>}
        </fieldset>
        <fieldset className="team-finance-choice" disabled={busy}>
          <legend>VAT</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.vatRegistered}
              onChange={(event) => change('vatRegistered', event.target.checked)}
            />
            VAT registered
          </label>
          <p className="team-finance-fixed">
            VAT rate <strong>{formatPercent(form.base?.vatRateBp ?? DEFAULT_VAT_RATE_BP)}</strong>{' '}
            (fixed)
          </p>
          <FinanceField name="trn" label="TRN" hint="Optional. 15 digits." error={errors.trn}>
            {(props) => (
              <input
                {...props}
                inputMode="numeric"
                autoComplete="off"
                maxLength={15}
                value={draft.trn}
                onChange={(event) => change('trn', event.target.value)}
              />
            )}
          </FinanceField>
        </fieldset>
        {form.failure.text && (
          <p className="field-error" role="alert">
            {form.failure.text}
          </p>
        )}
        <p className="team-finance-status" role="status">
          {form.saved}
        </p>
        <div className="team-finance-actions">
          {form.failure.conflict && (
            <Button variant="light" disabled={busy} onClick={form.loadLatest}>
              Load latest settings
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </section>
  );
}

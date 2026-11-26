import React, { useId } from 'react';
import { FinanceField } from '../server/finance/FinanceField.jsx';
import { formatPercent } from '../../lib/finance/money.js';
import {
  companyShareText,
  DEFAULT_VAT_RATE_BP,
  secondSourceOptions,
} from './financeSettingsForm.js';
import { useFinanceSettingsForm } from './useFinanceSettingsForm.js';
import { FinanceSettingsSaveBar } from './FinanceSettingsSaveBar.jsx';

/** Admin-only team commission split, referral limit and VAT registration (finance-design §7). */
export function FinanceSettingsPanel({ settings, actions }) {
  const titleId = useId();
  const formId = useId();
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
    <section className="team-finance-settings" aria-labelledby={titleId}>
      <div className="panel team-finance-panel">
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
        <form
          id={formId}
          ref={form.formRef}
          className="team-finance-form"
          noValidate
          onSubmit={form.submit}
        >
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
          <fieldset className="team-finance-choice is-options" disabled={busy}>
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
        </form>
      </div>
      <FinanceSettingsSaveBar form={form} formId={formId} busy={busy} />
    </section>
  );
}

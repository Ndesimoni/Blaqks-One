import React, { useState } from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FinanceDialog } from '../../finance/FinanceDialog.jsx';
import {
  eligibilityBody,
  eligibilityChanged,
  eligibilityForm,
  eligibilityImpacts,
  isConflict,
} from './companiesModel.js';

const FLAGS = [
  ['entitled', 'entitled', 'entitledHint'],
  ['licenceVerified', 'licence', 'licenceHint'],
];

/**
 * Two trusted flags and an optional verified address for one company website. Turning a
 * flag off states what leaves the websites and makes the save a danger action. A version
 * conflict reloads the list and shows the latest flags, keeping a typed address.
 */
export function CompanyEligibilityDialog({ api, row, onClose, onSaved, onReload }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteCompanies.${key}`, vars);
  const [base, setBase] = useState(row);
  const [form, setForm] = useState(() => eligibilityForm(row));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const impacts = eligibilityImpacts(base, form);
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { site } = await api.websiteEligibility(base.workspace, eligibilityBody(base, form));
      onSaved(site || {}, base);
    } catch (failure) {
      if (isConflict(failure)) {
        const latest = (await onReload())?.find((item) => item.workspace === base.workspace);
        if (latest) {
          setBase(latest);
          setForm((current) => ({ ...eligibilityForm(latest), host: current.host }));
        }
        setMessage(k('conflict'));
      } else setMessage(failure.message || k('saveError'));
      setBusy(false);
    }
  };
  return (
    <FinanceDialog
      eyebrow={base.company}
      title={k('dialogTitle')}
      intro={base.name}
      busy={busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={k(impacts.length ? 'turnOff' : 'save')}
      submitDisabled={!eligibilityChanged(base, form)}
      danger={impacts.length > 0}
      className="website-eligibility-dialog"
    >
      <fieldset className="finance-choice website-flags" disabled={busy}>
        <legend>{k('flags')}</legend>
        {FLAGS.map(([name, label, hint]) => (
          <div key={name} className="website-flag">
            <label>
              <input
                type="checkbox"
                checked={form[name]}
                aria-describedby={`website-flag-${name}`}
                onChange={(event) => set(name, event.target.checked)}
              />
              <span>{k(label)}</span>
            </label>
            <small id={`website-flag-${name}`}>{k(hint)}</small>
          </div>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="website-eligibility-host">{k('host')}</label>
        <input
          id="website-eligibility-host"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          maxLength={253}
          value={form.host}
          disabled={busy}
          aria-describedby="website-eligibility-host-hint"
          onChange={(event) => set('host', event.target.value)}
        />
        <small id="website-eligibility-host-hint" className="finance-hint">
          {k('hostHint')} {base.host ? k('currentHost', { host: base.host }) : ''}
        </small>
      </div>
      <div aria-live="polite">
        {impacts.length > 0 && (
          <div className="website-impact">
            <strong>{k('impact')}</strong>
            <ul>
              {impacts.map((impact) => (
                <li key={impact}>{k(impact, { company: base.company })}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}

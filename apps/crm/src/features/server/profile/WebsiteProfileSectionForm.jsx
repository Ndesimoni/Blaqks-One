import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { WebsiteProfileFields } from '../website/team/WebsiteProfileFields.jsx';
import * as model from '../website/team/websiteTeamModel.js';
import { InlineConfirm } from './InlineConfirm.jsx';
import { WebsiteProfileSectionStatus } from './WebsiteProfileSectionStatus.jsx';

/**
 * The member's own public details and consent. Consent is given or withdrawn only here;
 * turning it off asks first, because the server takes the profile and listings down at once.
 */
export function WebsiteProfileSectionForm({ own, admin, fallbackName, t }) {
  const { profile, live } = own;
  const saved = useMemo(() => model.profileForm(profile, fallbackName), [profile, fallbackName]);
  const [version, setVersion] = useState(profile?.version ?? 0);
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inputs = useRef({});
  if (version !== (profile?.version ?? 0)) {
    setVersion(profile?.version ?? 0);
    setForm(saved);
    setErrors({});
    setFailure((current) => (current?.stale ? null : current));
    setConfirming(false);
  }
  const changed = model.formChanged(form, saved);
  useUnsavedChanges(changed, busy);
  const k = (key, vars) => t(`websiteTeam.own.${key}`, vars);
  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailure(null);
    setStatus('');
  };
  const reset = () => {
    setForm(saved);
    setErrors({});
    setFailure(null);
    setConfirming(false);
  };
  const submit = async (event) => {
    event?.preventDefault();
    if (busy || !changed) return;
    const found = model.profileErrors(form);
    setErrors(found);
    const first = model.PROFILE_FIELDS.find((field) => found[field]);
    if (first) return inputs.current[first]?.focus();
    if (profile?.consent && !form.consent && !confirming) return setConfirming(true);
    setBusy(true);
    setFailure(null);
    try {
      await own.save(model.profileBody(form, profile, { self: true }));
      setStatus(k('saved'));
    } catch (error) {
      const key = model.profileFailure(error);
      const text = { stale: k('stale'), noSite: k(admin ? 'noSiteAdmin' : 'noSite') }[key];
      setFailure({ text: text || error.message, stale: key === 'stale' });
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  };
  return (
    <form className="acct-form wp-form" onSubmit={submit} noValidate>
      <div className="acct-card-body">
        <WebsiteProfileSectionStatus profile={profile} live={live} admin={admin} t={t} />
        <WebsiteProfileFields
          idPrefix="wp"
          form={form}
          errors={errors}
          busy={busy}
          inputs={inputs}
          onChange={change}
          t={t}
        />
        <label className="wp-consent">
          <input
            type="checkbox"
            checked={form.consent}
            disabled={busy}
            onChange={(event) => change('consent', event.target.checked)}
          />
          <span>{k('consent')}</span>
        </label>
        {failure && (
          <div className="acct-alert" role="alert">
            <p className="field-error">{failure.text}</p>
            {failure.stale && (
              <Button variant="light" onClick={own.reload}>
                {k('reload')}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="acct-card-foot">
        <div className="acct-foot-status">
          <div aria-live="polite">
            {status && (
              <p className="acct-success">
                <Icon name="check" size={15} />
                {status}
              </p>
            )}
          </div>
          {!status && changed && !confirming && <p className="acct-muted">{k('unsaved')}</p>}
        </div>
        {confirming ? (
          <InlineConfirm
            label={k('offLabel')}
            prompt={k('offPrompt', { count: live })}
            confirmLabel={k('offConfirm')}
            busy={busy}
            onConfirm={submit}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="acct-actions">
            <Button variant="light" disabled={busy || !changed} onClick={reset}>
              {k('discard')}
            </Button>
            <Button
              type="submit"
              className={busy ? 'acct-loading' : ''}
              disabled={busy || !changed}
              aria-busy={busy}
            >
              {busy ? k('saving') : k('save')}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

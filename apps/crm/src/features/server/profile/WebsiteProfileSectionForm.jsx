import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { SocialLinkFields } from '../website/social/SocialLinkFields.jsx';
import { WebsiteProfileFields } from '../website/team/WebsiteProfileFields.jsx';
import * as model from '../website/team/websiteTeamModel.js';
import { ConsentSwitch } from './ConsentSwitch.jsx';
import { ProfileCard } from './ProfileCard.jsx';
import { WebsiteProfileSectionFoot } from './WebsiteProfileSectionFoot.jsx';
import { WebsiteProfileSectionStatus } from './WebsiteProfileSectionStatus.jsx';

/**
 * The member's own public details, social links and consent, as the approved mockup's two
 * cards and save bar (design queue item 14). Consent is given or withdrawn only here; turning
 * it off asks first, because the server takes the profile and listings down at once. Links
 * save with the profile as the member's own (website-social-links.md).
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
  const edited = (field) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailure(null);
    setStatus('');
  };
  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    edited(field);
  };
  const changeLink = (field, value) => {
    setForm((current) => ({ ...current, social: { ...current.social, [field]: value } }));
    edited(field);
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
    const first = model.firstInvalid(found);
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
    <form className="acct-form wp-form page-stack acct-page" onSubmit={submit} noValidate>
      <div className="profile-grid">
        <ProfileCard id="website-show" title={k('showTitle')} description={k('showDescription')}>
          <div className="acct-card-body">
            <WebsiteProfileSectionStatus profile={profile} live={live} admin={admin} t={t} />
            <ConsentSwitch
              checked={form.consent}
              disabled={busy}
              onChange={(next) => change('consent', next)}
              t={t}
            />
            <WebsiteProfileFields
              idPrefix="wp"
              form={form}
              errors={errors}
              busy={busy}
              inputs={inputs}
              onChange={change}
              t={t}
            />
          </div>
        </ProfileCard>
        <ProfileCard id="website-links" title={k('linksTitle')} description={k('linksDescription')}>
          <div className="acct-card-body">
            <SocialLinkFields
              idPrefix="wp-social"
              legend={t('websiteSocial.ownLegend')}
              quietLegend
              hint={`${t('websiteSocial.ownHint')} ${t('websiteSocial.hint')}`}
              values={form.social}
              errors={errors}
              disabled={busy}
              inputs={inputs}
              onChange={changeLink}
            />
          </div>
        </ProfileCard>
      </div>
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
      <div className="panel profile-save-bar">
        <WebsiteProfileSectionFoot
          status={status}
          changed={changed}
          confirming={confirming}
          busy={busy}
          live={live}
          onConfirm={submit}
          onCancel={() => setConfirming(false)}
          onReset={reset}
          t={t}
        />
      </div>
    </form>
  );
}

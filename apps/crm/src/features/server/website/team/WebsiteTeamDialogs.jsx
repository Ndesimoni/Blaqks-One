import React, { useRef, useState } from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../../../hooks/useUnsavedChanges.js';
import { FinanceDialog } from '../../finance/FinanceDialog.jsx';
import { SocialLinkFields } from '../social/SocialLinkFields.jsx';
import { SocialLinkList } from '../social/SocialLinkList.jsx';
import { SOCIAL_FIELDS } from '../social/socialModel.js';
import { WebsiteProfileFields } from './WebsiteProfileFields.jsx';
import { firstInvalid, formChanged, profileErrors, profileForm } from './websiteTeamModel.js';

// Another member's public contacts and links: shown as text, kept as saved (owner, 2026-10-30).
const CONTACTS = ['publicWhatsApp', 'publicEmail'];

/**
 * The Admin edits a person's public details. Consent, contacts and social links are read-only
 * for someone else: only that person changes them, from My profile. The Admin's own row edits
 * their own contacts and links here too.
 */
export function WebsiteProfileDialog({ row, busy, message, onClose, onSave, onMyProfile, t }) {
  const [initial] = useState(() => profileForm(row.profile, row.member.name));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const inputs = useRef({});
  const locked = row.own ? [] : CONTACTS;
  useUnsavedChanges(formChanged(form, initial), busy);
  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const changeLink = (field, value) => {
    setForm((current) => ({ ...current, social: { ...current.social, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = () => {
    const found = profileErrors(form);
    if (!row.own) [...CONTACTS, ...SOCIAL_FIELDS].forEach((field) => delete found[field]);
    setErrors(found);
    const first = firstInvalid(found);
    if (first) return inputs.current[first]?.focus();
    return onSave(form);
  };
  const consent = Boolean(row.profile?.consent);
  return (
    <FinanceDialog
      eyebrow={row.member.name}
      title={t(row.profile ? 'websiteTeam.dialog.edit' : 'websiteTeam.dialog.setUp')}
      intro={t('websiteTeam.dialog.intro')}
      busy={busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('websiteTeam.dialog.save')}
      className="wt-dialog"
    >
      <WebsiteProfileFields
        idPrefix="wt-dialog"
        form={form}
        errors={errors}
        busy={busy}
        inputs={inputs}
        onChange={change}
        t={t}
        locked={locked}
        lockedExtra={<SocialLinkList values={form.social} title={t('websiteSocial.title')} />}
        lockedHint={t('websiteTeam.contacts.others', { name: row.member.name })}
      />
      {row.own && (
        <SocialLinkFields
          idPrefix="wt-dialog-social"
          legend={t('websiteSocial.ownLegend')}
          hint={t('websiteSocial.hint')}
          values={form.social}
          errors={errors}
          disabled={busy}
          inputs={inputs}
          onChange={changeLink}
        />
      )}
      <section className="wt-consent-note" aria-labelledby="wt-dialog-consent">
        <h3 id="wt-dialog-consent">{t('websiteTeam.dialog.consent')}</h3>
        <p className="wt-consent" data-state={consent ? 'given' : 'missing'}>
          <Icon name={consent ? 'check' : 'clock'} size={14} />
          {t(`websiteTeam.consent.${consent ? 'given' : 'missing'}`)}
        </p>
        {row.own ? (
          <button type="button" className="wt-link" disabled={busy} onClick={onMyProfile}>
            {t(row.profile ? 'websiteTeam.consent.own' : 'websiteTeam.consent.ownSetUp')}
          </button>
        ) : (
          <p className="wt-hint">{t('websiteTeam.consent.others', { name: row.member.name })}</p>
        )}
      </section>
    </FinanceDialog>
  );
}

/** Stop publishing or Hide: both take the person's live listings off the website now. */
export function WebsiteTeamConfirm({ kind, row, busy, message, onClose, onConfirm, t }) {
  return (
    <FinanceDialog
      eyebrow={row.member.name}
      title={t(`websiteTeam.${kind}.title`)}
      busy={busy}
      message={message}
      onClose={onClose}
      onSubmit={onConfirm}
      submitLabel={t(kind === 'hide' ? 'websiteTeam.hide.confirm' : 'websiteTeam.publishing.stop')}
      danger
      className="wt-dialog wt-confirm"
    >
      <p className="wt-confirm-text">
        {t(`websiteTeam.${kind}.text`, { name: row.member.name, count: row.live })}
      </p>
    </FinanceDialog>
  );
}

import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { PanelHead } from './PanelHead.jsx';
import { draftNotes } from './triageModel.js';

/**
 * Create lead from this conversation (design DesktopTriage): the name and notes are filled
 * from the messages for a person to check; the phone or email is the verified sender.
 */
export function CreateLeadPanel({ data, onSave, onClose, onDone }) {
  const { t, format } = useI18n();
  const id = useId();
  const row = data.conversation;
  const first = data.messages[0];
  const [name, setName] = useState(row.contact.name || '');
  const [notes, setNotes] = useState(draftNotes(data.messages));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const failure = await onSave({ name: name.trim() || null, notes: notes.trim() || null });
    setSaving(false);
    if (failure) setError(failure);
    else onDone();
  };
  return (
    <aside
      className="inbox-panel"
      aria-label={t('inboxTriage.lead.title')}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <PanelHead title={t('inboxTriage.lead.title')} onClose={onClose} />
      <form className="inbox-panel-section inbox-panel-form" onSubmit={save}>
        <span className="inbox-eyebrow">{t('inboxTriage.lead.eyebrow')}</span>
        <p className="inbox-panel-hint">{t('inboxTriage.lead.hint')}</p>
        <label htmlFor={`${id}-name`}>{t('inboxTriage.lead.name')}</label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={120}
          placeholder={t('inboxTriage.lead.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
        <span className="inbox-field-label">{t('inboxTriage.lead.contact')}</span>
        <bdi className="inbox-field-value">{row.contact.display}</bdi>
        <label htmlFor={`${id}-notes`}>{t('inboxTriage.lead.notes')}</label>
        <textarea
          id={`${id}-notes`}
          rows={4}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <span className="inbox-field-label">{t('inboxTriage.lead.source')}</span>
        <span className="inbox-field-value">
          {t(`inbox.channel.${row.channel}`)}
          {first && ` · ${format.dateTime(first.at)}`}
        </span>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="inbox-panel-footer">
          <Button type="submit" disabled={saving}>
            {saving ? t('inboxTriage.saving') : t('inboxTriage.lead.save')}
          </Button>
        </div>
      </form>
    </aside>
  );
}

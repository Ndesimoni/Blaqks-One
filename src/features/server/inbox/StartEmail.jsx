import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { RecipientPicker } from './RecipientPicker.jsx';

/**
 * New email (Start message, E1b/E1d): to a Client or Contact the member may see, from the
 * member's own connected mailbox. On success the new conversation opens.
 */
// A SendGrid company member without a usable address asks their Admin (E3d).
const notReady = {
  needAddress: 'inboxSend.start.needAddress',
  companyReconnect: 'inboxSend.start.companyReconnect',
};

export function StartEmail({ mailbox, onStart, onClose }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const id = useId();
  const [to, setTo] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = mailbox?.state === 'connected';
  const send = async (event) => {
    event.preventDefault();
    if (!to || !subject.trim() || !body.trim() || busy) return;
    setBusy(true);
    const failure = await onStart({
      collection: to.collection,
      recordId: to.id,
      subject: subject.trim(),
      body: body.trim(),
    });
    setBusy(false);
    if (failure) setError(t('inboxSend.start.failed', { reason: failure }));
  };
  return (
    <Drawer className="inbox-start" titleId={`${id}-title`} onClose={onClose}>
      <div className="drawer-top">
        <h2 id={`${id}-title`}>{t('inboxSend.start.title')}</h2>
        <Button
          variant="light"
          icon="close"
          aria-label={t('inboxSend.start.close')}
          onClick={onClose}
        />
      </div>
      {!ready ? (
        <div className="drawer-body inbox-start-body">
          <p>{t(notReady[mailbox?.state] ?? 'inboxSend.start.needMailbox')}</p>
          {!mailbox?.company && (
            <Button onClick={() => navigate('My mailbox')}>
              {t('inboxSend.reply.openMailbox')}
            </Button>
          )}
        </div>
      ) : (
        <form className="drawer-body inbox-start-body" onSubmit={send}>
          <label htmlFor={`${id}-to`}>{t('inboxSend.start.to')}</label>
          <RecipientPicker id={`${id}-to`} chosen={to} onChoose={setTo} />
          <label htmlFor={`${id}-subject`}>{t('inboxSend.start.subject')}</label>
          <input
            id={`${id}-subject`}
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label htmlFor={`${id}-body`}>{t('inboxSend.start.body')}</label>
          <textarea
            id={`${id}-body`}
            rows={6}
            maxLength={20000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="inbox-panel-hint">
            {t('inboxSend.start.from', { mailbox: '' })}
            <bdi>{mailbox.label}</bdi>
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="inbox-start-actions">
            <Button
              type="submit"
              icon="arrow"
              disabled={busy || !to || !subject.trim() || !body.trim()}
            >
              {busy ? t('inboxSend.start.sending') : t('inboxSend.start.send')}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

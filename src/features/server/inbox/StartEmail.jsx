import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useAttachments } from '../chat/useAttachments.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';
import { RecipientPicker } from './RecipientPicker.jsx';
import { safeName } from './saved/savedRepliesModel.js';
import { SavedRepliesButton } from './saved/SavedRepliesButton.jsx';

/**
 * New email (Start message, E1b/E1d): to a Client or Contact the member may see, from the
 * member's own connected mailbox. On success the new conversation opens.
 */
// A SendGrid company member without a usable address asks their Admin (E3d).
const notReady = {
  needAddress: 'inboxSend.start.needAddress',
  adminNeedsAddress: 'inboxSend.start.adminNeedsAddress',
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
  const bodyRef = useRef(null);
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const files = useAttachments(api, owner.id);
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
      ...(files.ids.length ? { attachments: files.ids } : {}),
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
          {mailbox?.state === 'adminNeedsAddress' && (
            <Button onClick={() => navigate('Channels')}>
              {t('inboxSend.reply.openChannels')}
            </Button>
          )}
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
          {/* Attachments go through company email only (F3a). */}
          <ComposerBox
            files={mailbox.company ? files : null}
            attachDisabled={busy}
            tools={
              <SavedRepliesButton
                textareaRef={bodyRef}
                text={body}
                setText={setBody}
                values={{ clientName: safeName(to?.name), myName: user.name, company: owner.name }}
                disabled={busy}
              />
            }
            action={
              <Button
                type="submit"
                icon="arrow"
                disabled={busy || files.busy || !to || !subject.trim() || !body.trim()}
              >
                {busy ? t('inboxSend.start.sending') : t('inboxSend.start.send')}
              </Button>
            }
          >
            <textarea
              id={`${id}-body`}
              ref={bodyRef}
              className="composer-input"
              rows={6}
              maxLength={20000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </ComposerBox>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Drawer>
  );
}

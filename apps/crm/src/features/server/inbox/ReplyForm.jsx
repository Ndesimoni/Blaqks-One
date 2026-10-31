import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useAttachments } from '../chat/useAttachments.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';
import { DraftStatus } from './DraftStatus.jsx';
import { clientName, leftFillIns } from './saved/savedRepliesModel.js';
import { SavedRepliesButton } from './saved/SavedRepliesButton.jsx';
import { useDraft } from './useDraft.js';

/**
 * The email reply form (E1d, N2): the member's private draft comes back here, saved replies
 * go in from the box's button, and sending first waits for any draft save, so a sent reply
 * never returns as a draft (docs/saved-replies-drafts.md, review H1).
 */
export function ReplyForm({ id, conversation, mailbox, onReply }) {
  const { t } = useI18n();
  const textRef = useRef(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const files = useAttachments(api, owner.id);
  const draft = useDraft(conversation.id, text, setText);
  const values = { clientName: clientName(conversation), myName: user.name, company: owner.name };
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    await draft.beforeSend();
    const failure = await onReply(text.trim(), files.ids);
    setBusy(false);
    if (failure) {
      draft.sendFailed();
      setError(t('inboxSend.reply.failed', { reason: failure }));
    } else {
      setText('');
      setError('');
      files.clear();
      await draft.sent();
    }
  };
  return (
    <form id={`${id}-reply`} className="inbox-reply-form" onSubmit={send}>
      <label htmlFor={`${id}-reply-text`} className="sr-only">
        {t('inboxSend.reply.field')}
      </label>
      {/* Attachments go through company email only (F3a). */}
      <ComposerBox
        files={mailbox.company ? files : null}
        attachDisabled={busy}
        meta={<DraftStatus draft={draft} fillIns={leftFillIns(text)} />}
        tools={
          <SavedRepliesButton
            textareaRef={textRef}
            text={text}
            setText={setText}
            values={values}
            disabled={busy}
          />
        }
        action={
          <Button type="submit" icon="arrow" disabled={busy || files.busy || !text.trim()}>
            {busy ? t('inboxSend.reply.sending') : t('inboxSend.reply.send')}
          </Button>
        }
      >
        <textarea
          id={`${id}-reply-text`}
          ref={textRef}
          className="composer-input"
          rows={1}
          maxLength={20000}
          value={text}
          placeholder={t('inboxSend.reply.placeholder')}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send(event);
          }}
        />
      </ComposerBox>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { canReplyOn } from '../inbox/inboxModel.js';
import { PersonEmail } from '../inbox/PersonEmail.jsx';
import { useOpenMessenger } from '../products/messenger/messengerContext.js';
import { CalcRow } from './CalcRow.jsx';
import { calcSummary } from './calcSummary.js';

/**
 * The mockup's Result card: the result lines (or what to enter), Copy summary and Send to a
 * client, which starts a new email with the summary to a client the member picks and then
 * opens its conversation. Send shows only to members who may email clients. `ready` enables
 * both; `actions` adds a calculator's own buttons.
 */
export function CalcResult({ title, inputs, rows, ready, prompt, actions }) {
  const { t } = useI18n();
  const uid = useId();
  const { user } = useSession();
  const { setToast } = useWorkspaceView();
  const openMessenger = useOpenMessenger();
  const canSend = openMessenger && canOpenSection(user, 'Inbox') && canReplyOn(user, 'email');
  const [sending, setSending] = useState(false);
  const note = t('calculators.estimate');
  const summary = ready ? calcSummary({ title, inputs, rows, note }) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setToast(t('calculators.copied'));
    } catch {
      setToast(t('calculators.copyFailed'));
    }
  };
  return (
    <section className="panel calc-card calc-result" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>{t('calculators.result')}</h3>
      <div aria-live="polite">
        {!ready && <p className="calc-note">{prompt}</p>}
        {rows.length > 0 && (
          <dl className="calc-rows">
            {rows.map((row) => (
              <CalcRow key={row.id ?? row.label} {...row} />
            ))}
          </dl>
        )}
      </div>
      <div className="calc-actions">
        <Button variant="light" disabled={!ready} onClick={copy}>
          {t('calculators.copy')}
        </Button>
        {canSend && (
          <Button variant="light" disabled={!ready} onClick={() => setSending(true)}>
            {t('calculators.send')}
          </Button>
        )}
        {actions}
      </div>
      <p className="calc-note">{note}</p>
      {sending && (
        <PersonEmail
          subject={t('calculators.subject', { title })}
          body={summary}
          onSent={(id) => openMessenger('inbox', id)}
          onClose={() => setSending(false)}
        />
      )}
    </section>
  );
}

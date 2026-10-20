import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { MailboxConfirm } from './MailboxConfirm.jsx';
import { useMailbox } from './useMailbox.js';
import './mailbox.css';

/** My mailbox (E1d): connect, sign in again or disconnect the member's own Google mailbox. */
export function ServerMailbox() {
  const { api } = useSession();
  const { owner } = useWorkspaceScope();
  const { t, format } = useI18n();
  const { status, data, error, reload, connect, disconnect } = useMailbox(api, owner.id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  if (status === 'loading' && !data) return <p role="status">{t('mailbox.loading')}</p>;
  if (status === 'error')
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {t('mailbox.loadFailed')}
        </p>
        <Button onClick={reload}>{t('mailbox.retry')}</Button>
      </section>
    );
  const { google, mayConnect, mailbox } = data;
  const attention = mailbox?.state === 'reconnect_required';
  const act = async (action) => {
    setBusy(true);
    setNotice('');
    const failure = await action();
    // A successful connect has already left for Google.
    setBusy(false);
    if (failure) setNotice(failure);
    return failure;
  };
  const off = async () => {
    if (!(await act(disconnect))) {
      setConfirm(false);
      setNotice(t('mailbox.disconnect.done'));
    }
  };
  return (
    <div className="mailbox-page">
      {notice && (
        <p className="mailbox-notice" role="status">
          {notice}
        </p>
      )}
      <article className="mailbox-card" aria-labelledby="mailbox-title">
        <header className="mailbox-head">
          <span className="mailbox-icon" aria-hidden="true">
            <Icon name="note" size={20} />
          </span>
          <div>
            <h2 id="mailbox-title">{t('mailbox.card.title')}</h2>
            {mailbox && (
              <p>
                <bdi>{mailbox.label}</bdi>
              </p>
            )}
          </div>
          {mailbox && (
            <Badge tone={attention ? 'amber' : 'green'}>
              {t(attention ? 'mailbox.card.attention' : 'mailbox.card.connected')}
            </Badge>
          )}
        </header>
        {!google ? (
          <p className="mailbox-muted">{t('mailbox.notSetUp')}</p>
        ) : !mayConnect ? (
          <p className="mailbox-muted">{t('mailbox.noAccess')}</p>
        ) : (
          <>
            <p className="mailbox-muted">
              {attention
                ? t('mailbox.card.attentionBody')
                : mailbox
                  ? t('mailbox.card.since', { date: format.date(mailbox.credentialUpdatedAt) })
                  : t('mailbox.card.none')}
            </p>
            <p className="mailbox-what">{t('mailbox.card.what')}</p>
            {confirm ? (
              <MailboxConfirm busy={busy} onConfirm={off} onCancel={() => setConfirm(false)} />
            ) : (
              <div className="mailbox-actions">
                {(!mailbox || attention) && (
                  <Button icon="link" disabled={busy} onClick={() => act(connect)}>
                    {busy
                      ? t('mailbox.connecting')
                      : t(mailbox ? 'mailbox.reconnect' : 'mailbox.connect')}
                  </Button>
                )}
                {mailbox && (
                  <Button variant="danger-light" disabled={busy} onClick={() => setConfirm(true)}>
                    {t('mailbox.disconnect')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}

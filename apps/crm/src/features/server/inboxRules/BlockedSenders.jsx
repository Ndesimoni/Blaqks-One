import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { contactTitle } from '../inbox/inboxModel.js';
import { ProfileCard } from '../profile/ProfileCard.jsx';

/**
 * The mockup's Blocked senders card: the company conversations blocked as spam (the Inbox's
 * Spam tab), each with its channel and Unblock. Unblocking uses the conversation's version, so
 * a stale row is refused and the list reloads.
 */
export function BlockedSenders({ api, workspaceId }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(
    (signal) =>
      api
        .conversations(workspaceId, { state: 'spam', limit: 50 }, signal)
        .then((page) => setRows(page.conversations || []))
        .catch((failure) => {
          if (failure.name !== 'AbortError') setError(failure.message);
        }),
    [api, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const unblock = async (row) => {
    setBusy(row.id);
    setError('');
    try {
      await api.unblockConversation(workspaceId, row.id, { expectedVersion: row.version });
    } catch (failure) {
      setError(failure.message);
    }
    await load();
    setBusy('');
  };
  return (
    <ProfileCard id="rules-blocked" title={t('inboxRules.blocked.title')}>
      <div className="acct-card-body rules-blocked">
        {rows === null && !error && <p className="acct-muted">{t('inboxRules.loading')}</p>}
        {rows?.length === 0 && <p className="acct-muted">{t('inboxRules.blocked.none')}</p>}
        {rows?.length > 0 && (
          <ul className="rules-list" aria-label={t('inboxRules.blocked.title')}>
            {rows.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{contactTitle(row)}</strong>
                  <small>{t(`inbox.channel.${row.channel}`)}</small>
                </span>
                <Button
                  variant="light"
                  disabled={Boolean(busy)}
                  aria-label={t('inboxRules.blocked.unblockNamed', { name: contactTitle(row) })}
                  onClick={() => unblock(row)}
                >
                  {t('inboxRules.blocked.unblock')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="acct-muted">{t('inboxRules.blocked.body')}</p>
      </div>
    </ProfileCard>
  );
}

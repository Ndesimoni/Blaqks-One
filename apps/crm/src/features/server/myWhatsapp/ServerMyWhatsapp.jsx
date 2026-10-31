import React, { useRef, useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ConfirmDisconnect } from '../channels/ConfirmDisconnect.jsx';
import { useMyWhatsapp } from './useMyWhatsapp.js';
import '../channels/channels.css';
import '../mailbox/mailbox.css';
import './my-whatsapp.css';

/**
 * Settings → My WhatsApp (W1a): the number the Admin gave this member from the company's
 * Twilio account (WQ3), and Disconnect for it. Members never choose a number here.
 */
export function ServerMyWhatsapp() {
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { navigate } = useNavigation();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`myWhatsapp.${key}`, vars);
  const { status, loaded, number, reload, disconnect } = useMyWhatsapp(api, owner.id, user.id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState(null);
  const heading = useRef(null);
  const admin = user.roleId === 'admin';
  if (status === 'loading' && !loaded) return <p role="status">{k('loading')}</p>;
  if (status === 'forbidden')
    return (
      <section className="panel recovery-panel">
        <p>{k('noAccess')}</p>
      </section>
    );
  if (status === 'error')
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {k('loadFailed')}
        </p>
        <Button onClick={reload}>{k('retry')}</Button>
      </section>
    );
  const off = async () => {
    setBusy(true);
    setNotice(null);
    const failure = await disconnect(k('failed'));
    setBusy(false);
    setConfirm(false);
    setNotice(failure ? { text: failure, error: true } : { text: k('disconnect.done') });
    if (!failure) heading.current?.focus();
  };
  return (
    <div className="mailbox-page">
      <div role="status" aria-live="polite">
        {notice && (
          <p className={notice.error ? 'mailbox-notice field-error' : 'mailbox-notice'}>
            {notice.text}
          </p>
        )}
      </div>
      <article className="mailbox-card" aria-labelledby="my-whatsapp-title">
        <header className="mailbox-head">
          <span className="mailbox-icon" aria-hidden="true">
            <Icon name="smartphone" size={20} />
          </span>
          <div>
            <h2 id="my-whatsapp-title" ref={heading} tabIndex={-1}>
              {k('cardTitle')}
            </h2>
            <p>{k('provider')}</p>
          </div>
          <Badge tone={number ? 'green' : 'slate'}>
            {k(number ? 'badge.ready' : 'badge.none')}
          </Badge>
        </header>
        {number ? (
          <>
            <div className="mailbox-address">
              <span>{k('label')}</span>
              <strong className="u-ltr my-whatsapp-phone">
                <bdi>{number.phone}</bdi>
              </strong>
              {number.createdAt && (
                <small>{k('since', { date: format.date(number.createdAt) })}</small>
              )}
            </div>
            <p className="mailbox-what">{k('what')}</p>
            <p className="mailbox-muted mailbox-note">{k('work')}</p>
            {confirm ? (
              <ConfirmDisconnect
                t={t}
                busy={busy}
                title={k('disconnect.title')}
                body={k(admin ? 'disconnect.adminBody' : 'disconnect.body')}
                action={k('disconnect.confirm')}
                cancel={k('disconnect.cancel')}
                onCancel={() => setConfirm(false)}
                onConfirm={off}
              />
            ) : (
              <div className="mailbox-actions">
                <Button variant="danger-light" disabled={busy} onClick={() => setConfirm(true)}>
                  {k('disconnect')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mailbox-muted">{k(admin ? 'adminNone' : 'none')}</p>
            {admin && (
              <div className="mailbox-actions">
                <Button variant="light" onClick={() => navigate('Channels')}>
                  {k('openChannels')}
                </Button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}

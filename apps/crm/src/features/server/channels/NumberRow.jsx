import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ConfirmDisconnect } from './ConfirmDisconnect.jsx';

/** One member's number: who holds it, since when, and Disconnect after a confirmation. */
export function NumberRow({ number, memberName, t, format, busy, onDisconnect }) {
  const [confirm, setConfirm] = useState(false);
  const k = (key, vars) => t(`whatsappNumbers.${key}`, vars);
  const phone = number.phone;
  return (
    <div className="address-row whatsapp-number">
      <div className="address-main">
        <strong>{memberName}</strong>
        <Badge tone="green">{t('channels.status.connected')}</Badge>
      </div>
      <span className="whatsapp-phone u-ltr">
        <bdi>{phone}</bdi>
      </span>
      {number.createdAt && <small>{k('since', { date: format.date(number.createdAt) })}</small>}
      {confirm ? (
        <ConfirmDisconnect
          t={t}
          busy={busy}
          title={k('disconnectTitle', { phone, member: memberName })}
          body={k('disconnectBody', { member: memberName })}
          action={k('disconnectConfirm')}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            // A refusal (such as a stale version) shows in the section notice.
            await onDisconnect(number);
            setConfirm(false);
          }}
        />
      ) : (
        <div className="channel-actions">
          <Button
            variant="light"
            disabled={busy}
            aria-label={k('disconnectFor', { phone })}
            onClick={() => setConfirm(true)}
          >
            {k('disconnect')}
          </Button>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';

/**
 * Whether SendGrid sends delivery updates and passes on incoming mail. Both off usually
 * means the CRM has no public web address yet; incoming mail alone off means another
 * service already receives the domain's mail in SendGrid (docs/sendgrid-design.md §11–§12).
 */
export function SendgridStatus({ connection, t }) {
  const rows = [
    ['delivery', connection.deliveryUpdates === true, 'channels.sendgrid.needsAddress'],
    [
      'incoming',
      connection.incomingMail === true,
      connection.deliveryUpdates
        ? 'channels.sendgrid.incomingTaken'
        : 'channels.sendgrid.needsAddress',
    ],
  ];
  return (
    <ul className="channel-status" aria-label={t('channels.sendgrid.statusLabel')}>
      {rows.map(([key, on, hint]) => (
        <li key={key}>
          <div className="channel-status-line">
            <span>{t(`channels.sendgrid.${key}`)}</span>
            <Badge tone={on ? 'green' : 'slate'}>
              {t(on ? 'channels.sendgrid.on' : 'channels.sendgrid.off')}
            </Badge>
          </div>
          {!on && <small>{t(hint)}</small>}
        </li>
      ))}
    </ul>
  );
}

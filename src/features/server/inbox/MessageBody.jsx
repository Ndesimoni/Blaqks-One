import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { splitQuoted } from './composerModel.js';

/** Email replies fold the quoted earlier mail under a toggle (E1c). */
export function MessageBody({ message, channel, t }) {
  if (!message.body) return message.hasMedia ? t('inbox.message.media') : '';
  const { text, quoted } =
    channel === 'email' && message.direction === 'inbound'
      ? splitQuoted(message.body)
      : { text: message.body, quoted: '' };
  return (
    <>
      {text}
      {quoted && (
        <details className="inbox-quoted">
          <summary>
            <Icon name="chevron" size={14} />
            {t('inboxSend.message.quoted')}
          </summary>
          {quoted}
        </details>
      )}
    </>
  );
}

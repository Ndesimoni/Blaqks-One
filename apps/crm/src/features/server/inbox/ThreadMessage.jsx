import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { MessageFiles } from '../chat/MessageFiles.jsx';
import { MessageAgain } from './MessageAgain.jsx';
import { MessageBody } from './MessageBody.jsx';
import { failureKey } from './whatsapp/whatsappCodes.js';
import { templateName } from './whatsapp/whatsappModel.js';

/** Status words a message may show; email never claims Read (design States artboard). */
function statusText(t, message, channel) {
  if (message.direction === 'inbound') return '';
  if (message.status === 'read' && channel === 'email') return t('inbox.message.delivered');
  if (message.status === 'sending') return t('inboxSend.message.sending');
  return t(`inbox.message.${message.status}`);
}

/**
 * One message: the bubble, its time and status, and Send again where allowed. A WhatsApp
 * template shows its filled-in text under a small "Template · name" label (W1b), and a failed
 * WhatsApp message says why in plain words (design §11).
 */
export function ThreadMessage({ message, conversation, t, format, again, onAgain, fileUrl }) {
  const { channel, contact, whatsapp } = conversation;
  const otherSender = message.sender && message.sender !== contact?.display ? message.sender : '';
  const outbound = message.direction === 'outbound';
  const status = statusText(t, message, channel);
  const template = message.template ? templateName(whatsapp?.templates, message.template) : '';
  const failed = channel === 'whatsapp' && outbound && message.status === 'failed';
  return (
    <li className={'inbox-message' + (outbound ? ' is-outbound' : ' is-inbound')}>
      <div
        className={
          'inbox-bubble' +
          (message.status === 'failed' || message.senderUnverified ? ' is-failed' : '')
        }
      >
        {message.template && (
          <span className="wa-template-label">
            <Icon name="layers" size={12} aria-hidden="true" />
            {template
              ? t('whatsappSend.template.message', { name: template })
              : t('whatsappSend.template.messagePlain')}
          </span>
        )}
        {/* A fraud cue: forged senders often ask for payments (security review E1c M2). */}
        {message.senderUnverified && (
          <strong className="inbox-unverified">
            <Icon name="info" size={14} />
            {t('inboxSend.message.unverified')}
          </strong>
        )}
        <MessageBody message={message} channel={channel} t={t} />
        <MessageFiles files={message.attachments} urlOf={(file) => fileUrl(message.id, file)} />
        {/* Files from clients are not scanned yet: say where they came from (F3b review M1). */}
        {!outbound && message.attachments?.length > 0 && (
          <em className="inbox-media">{t('inboxSend.message.outsideFiles')}</em>
        )}
        {message.filesNotKept > 0 ? (
          // F3b: only photos and PDFs from verified senders, within the daily limits, are kept.
          <em className="inbox-media">
            {t('inboxSend.message.filesNotKept', { count: message.filesNotKept })}
          </em>
        ) : (
          message.body &&
          message.hasMedia &&
          !message.attachments?.length && (
            <em className="inbox-media">{t('inbox.message.media')}</em>
          )
        )}
      </div>
      <span className="inbox-message-meta">
        <time dateTime={message.at}>{format.time(message.at)}</time>
        {status && <span> · {status}</span>}
        {otherSender && (
          <span>
            {' · '}
            {t('inboxSend.message.from', { sender: '' })}
            <bdi>{otherSender}</bdi>
          </span>
        )}
      </span>
      {failed && (
        <span className="wa-failure">
          {t(`whatsappReasons.${failureKey(message.failureReason)}`)}
        </span>
      )}
      {again && <MessageAgain message={message} channel={channel} onAgain={onAgain} />}
    </li>
  );
}

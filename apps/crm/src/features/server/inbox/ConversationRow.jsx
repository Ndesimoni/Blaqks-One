import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { badge } from '../chat/chatModel.js';
import { ageLabel, contactTitle, initials, statusKey } from './inboxModel.js';

/**
 * One conversation in the list: avatar, sender, age, channel, latest message, how many
 * messages are unread (the server counts to 100, shown as 99+) and status.
 */
export function ConversationRow({ row, selected, onOpen }) {
  const { t, format } = useI18n();
  const age = ageLabel(row.lastActivityAt);
  const ageText =
    age.key === 'inbox.age.date'
      ? format.date(age.vars.day, { dateStyle: 'medium' })
      : t(age.key, age.vars);
  const unknown = row.match !== 'linked';
  const status = statusKey(row);
  const unread = Number(row.unreadCount) || (row.unread ? 1 : 0);
  return (
    <li>
      <button
        type="button"
        className={
          'inbox-row' + (selected ? ' is-selected' : '') + (row.unread ? ' is-unread' : '')
        }
        aria-current={selected ? 'true' : undefined}
        data-conversation={row.id}
        onClick={() => onOpen(row.id)}
      >
        <span className={'inbox-avatar' + (unknown ? ' is-unknown' : '')} aria-hidden="true">
          {initials(row)}
        </span>
        <span className="inbox-row-body">
          <span className="inbox-row-top">
            <bdi className="inbox-row-name">{contactTitle(row)}</bdi>
            <time className="inbox-row-age" dateTime={row.lastActivityAt}>
              {ageText}
            </time>
          </span>
          <span className="inbox-row-line">
            <span className={`inbox-chip is-${row.channel}`}>
              {t(`inbox.channel.${row.channel}`)}
            </span>
            <span className="inbox-row-preview">{row.preview || t('inbox.row.noText')}</span>
            {unread > 0 && (
              <span className="inbox-unread-count">
                <span aria-hidden="true">{badge(unread)}</span>
                <span className="sr-only">
                  {unread > 99
                    ? t('inbox.row.unreadMany')
                    : t('inbox.nav.unread', { count: unread })}
                </span>
              </span>
            )}
          </span>
          <span className={`inbox-row-status is-${status.split('.').pop()}`}>{t(status)}</span>
        </span>
      </button>
    </li>
  );
}

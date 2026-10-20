import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { contactTitle, initials } from './inboxModel.js';

const STATES = ['open', 'waiting', 'resolved'];

/**
 * Sender, channel and holder, with the state and assignment controls. Managers and
 * whole-team staff pick any member; assigned-only staff may only claim or release.
 */
export function ConversationHeader({
  row,
  user,
  members,
  nameOf,
  busy,
  onUpdate,
  onBack,
  onDetails,
}) {
  const { t } = useI18n();
  const id = useId();
  const mine = row.assigneeId === user.id;
  const holder = row.assigneeId
    ? mine
      ? t('inbox.header.you')
      : nameOf(row.assigneeId)
    : t('inbox.header.unassigned');
  const blocked = row.state === 'spam';
  return (
    <header className="inbox-head">
      <button
        type="button"
        className="inbox-icon-button inbox-back"
        aria-label={t('inbox.header.back')}
        onClick={onBack}
      >
        <Icon name="arrow" size={18} />
      </button>
      <span
        className={'inbox-avatar' + (row.match !== 'linked' ? ' is-unknown' : '')}
        aria-hidden="true"
      >
        {initials(row)}
      </span>
      <div className="inbox-head-text">
        <h2>
          <bdi>{contactTitle(row)}</bdi>
        </h2>
        <p>
          {t(`inbox.channel.${row.channel}`)} · <bdi>{row.contact.display}</bdi> · {holder}
        </p>
      </div>
      <button
        type="button"
        className="inbox-icon-button inbox-details"
        aria-label={t('inbox.header.details')}
        onClick={onDetails}
      >
        <Icon name="info" size={18} />
      </button>
      <div className="inbox-head-actions">
        {!blocked && (
          <>
            <label htmlFor={`${id}-state`} className="sr-only">
              {t('inbox.header.state')}
            </label>
            <select
              id={`${id}-state`}
              value={STATES.includes(row.state) ? row.state : ''}
              disabled={busy}
              onChange={(event) => onUpdate({ state: event.target.value })}
            >
              {!STATES.includes(row.state) && (
                <option value="">{t(`inbox.state.${row.state}`)}</option>
              )}
              {STATES.map((name) => (
                <option key={name} value={name}>
                  {t(`inbox.state.${name}`)}
                </option>
              ))}
            </select>
          </>
        )}
        {members.length > 0 ? (
          <>
            <label htmlFor={`${id}-assign`} className="sr-only">
              {t('inbox.header.assign')}
            </label>
            <select
              id={`${id}-assign`}
              value={row.assigneeId || ''}
              disabled={busy}
              onChange={(event) => onUpdate({ assigneeId: event.target.value || null })}
            >
              <option value="">{t('inbox.header.unassigned')}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === user.id
                    ? t('inbox.header.youNamed', { name: member.name })
                    : member.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          (!row.assigneeId || mine) && (
            <Button
              variant="light"
              disabled={busy}
              onClick={() => onUpdate({ assigneeId: mine ? null : user.id })}
            >
              {mine ? t('inbox.header.release') : t('inbox.header.claim')}
            </Button>
          )
        )}
      </div>
    </header>
  );
}

import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import './team-seats.css';

/**
 * The seat bar above the team (approved mockup, Bitrix24's structure): the plan, seats used
 * with a meter and what uses a seat, beside Change limit and Invite teammate. The top bar
 * names the page, so archived teams show only why they are read-only.
 */
export function TeamDirectoryToolbar({
  owner,
  archived,
  seats,
  canChangeLimit,
  onChangeLimit,
  onInvite,
  busy,
}) {
  const { t } = useI18n();
  const open = owner.status !== 'archived' && !archived;
  const limited = Number.isInteger(seats?.limit);
  const full = limited && seats.used >= seats.limit;
  const share = limited && seats.limit > 0 ? Math.min(100, (seats.used / seats.limit) * 100) : 0;
  return (
    <div className="panel connected-team-toolbar">
      {open && limited ? (
        <div className="team-seat-bar">
          <div className="team-seat-summary" aria-live="polite">
            <strong>{t('teamSeats.freePlan')}</strong>
            <span>{t('teamSeats.usage', { used: seats.used, limit: seats.limit })}</span>
          </div>
          <div className={'team-seat-meter' + (full ? ' is-full' : '')} aria-hidden="true">
            <span style={{ inlineSize: `${share}%` }} />
          </div>
          <p id="team-seat-capacity">
            {t(full ? 'teamSeats.full' : 'teamSeats.explainer', { limit: seats.limit })}
          </p>
        </div>
      ) : (
        <p className="team-seat-note">
          {open
            ? 'People share this workspace with the access you assign. Other Admin teams stay separate.'
            : 'Archived accounts are read-only. Sign-in is blocked and all saved data is retained.'}
        </p>
      )}
      {open && seats && (limited || seats.limit === null) && (
        <div className="team-seat-buttons">
          {limited && canChangeLimit && (
            <Button variant="light" disabled={busy} onClick={onChangeLimit}>
              {t('teamSeats.change')}
            </Button>
          )}
          <Button
            icon="plus"
            disabled={busy || full}
            aria-describedby={full ? 'team-seat-capacity' : undefined}
            onClick={onInvite}
          >
            {t('teamSeats.invite')}
          </Button>
        </div>
      )}
    </div>
  );
}

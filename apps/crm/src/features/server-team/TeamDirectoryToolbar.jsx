import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';

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
  const frozen = owner.status === 'archived';
  const limited = Number.isInteger(seats?.limit);
  const full = limited && seats.used >= seats.limit;
  return (
    <>
      <div className="panel connected-team-toolbar">
        <div>
          <h2>{owner.name} team</h2>
          <p>
            {frozen || archived
              ? 'Archived accounts are read-only. Sign-in is blocked and all saved data is retained.'
              : 'People share this workspace with the access you assign. Other Admin teams stay separate.'}
          </p>
        </div>
        {!frozen && !archived && limited && (
          <div className="team-seat-actions">
            <div className="team-seat-summary" aria-live="polite">
              <strong>{t('teamSeats.freePlan')}</strong>
              <span>{t('teamSeats.usage', { used: seats.used, limit: seats.limit })}</span>
            </div>
            <div className="team-seat-buttons">
              {canChangeLimit && (
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
            <small id="team-seat-capacity">
              {t(full ? 'teamSeats.full' : 'teamSeats.explainer', { limit: seats.limit })}
            </small>
          </div>
        )}
        {!frozen && !archived && seats && seats.limit === null && (
          <Button icon="plus" disabled={busy} onClick={onInvite}>
            {t('teamSeats.invite')}
          </Button>
        )}
      </div>
    </>
  );
}

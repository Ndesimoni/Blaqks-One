import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ProfileCard } from '../profile/ProfileCard.jsx';

/**
 * The mockup's Plan and seats card: the Free plan and the seats in use (active members and
 * pending invitations, as Team & access counts them). Blaqks One sets the limit.
 */
export function CompanyPlan() {
  const { t } = useI18n();
  const { api, user } = useSession();
  const [seats, setSeats] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api
      .team(user.workspaceId, controller.signal)
      .then((team) => {
        if (!Number.isInteger(team?.seats?.used)) throw Error('The seat summary was incomplete.');
        if (!controller.signal.aborted) setSeats(team.seats);
      })
      .catch((failure) => {
        if (!controller.signal.aborted && failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, user.workspaceId, attempt]);
  return (
    <ProfileCard id="company-plan" title={t('company.plan')}>
      <div className="acct-card-body">
        <dl className="company-facts">
          <div>
            <dt>{t('company.planLabel')}</dt>
            <dd>{t('company.free')}</dd>
          </div>
          <div>
            <dt>{t('company.seatsLabel')}</dt>
            <dd>
              {seats
                ? t('company.seatsUsed', { used: seats.used, limit: seats.limit ?? '∞' })
                : error
                  ? '—'
                  : t('company.loading')}
            </dd>
          </div>
        </dl>
        {error && (
          <p className="field-error" role="alert">
            {error}{' '}
            <Button variant="light" onClick={() => setAttempt((value) => value + 1)}>
              {t('company.retry')}
            </Button>
          </p>
        )}
        <p className="acct-muted">{t('company.seatsNote')}</p>
      </div>
    </ProfileCard>
  );
}

import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { displayState, inCompany, ownSide, stateTone, turn } from './agreementModel.js';

/** `ours` marks a side of the caller's own company: theirs, or both in an in-company hand-over. */
function PartyCard({ role, person, mine, ours, named }) {
  const { t } = useI18n();
  return (
    <div className={'agreement-party' + (mine ? ' is-mine' : '')}>
      <span className="agreement-label">{t(`agreements.party.${role}`)}</span>
      <strong>
        {person?.name || t('agreements.party.unknown')}
        {named && <span className="agreement-you"> {t('agreements.party.you')}</span>}
      </strong>
      <small>
        {person?.company ||
          t(ours ? 'agreements.party.yourCompany' : 'agreements.party.otherCompany')}
      </small>
    </div>
  );
}

/**
 * The agreement's state, whose move it is and when the offer ends, then the two named
 * participants with the caller's own side marked.
 */
export function AgreementSummary({ detail }) {
  const { user } = useSession();
  const { t, format } = useI18n();
  const { agreement, revision, party } = detail;
  const state = displayState(agreement, revision.authorParty);
  const move = turn(agreement, party, revision.authorParty);
  const side = ownSide(agreement, user.workspaceId, user.id);
  const open = ['draft', 'sent'].includes(agreement.state);
  return (
    <>
      <div className="agreement-status">
        <Badge tone={stateTone(state)}>{t(`agreements.state.${state}`)}</Badge>
        <p className={move === 'yourAnswer' ? 'is-urgent' : ''}>
          {move === 'closed'
            ? t('agreements.row.updated', { date: format.dateTime(agreement.updatedAt) })
            : t(`agreements.turn.${move}`)}
        </p>
        {open && (
          <small>
            {t(agreement.expired ? 'agreements.status.ended' : 'agreements.status.ends', {
              date: format.dateTime(agreement.expiresAt || revision.terms.expiresAt),
            })}
          </small>
        )}
      </div>
      <div className="agreement-parties">
        {['sender', 'recipient'].map((role) => (
          <PartyCard
            key={role}
            role={role}
            person={agreement.parties?.[role]}
            mine={side === role}
            ours={side === role || inCompany(agreement)}
            named={party === role}
          />
        ))}
      </div>
    </>
  );
}

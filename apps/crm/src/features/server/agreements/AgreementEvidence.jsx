import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { approvalKey, approvalOf } from './approvalWording.js';

const nameOf = (agreement, party, t) =>
  agreement.parties?.[party]?.name || t(`agreements.party.${party}`);

/** Every revision the caller may see, oldest first; choosing one shows its frozen terms. */
export function RevisionPicker({ revisions, selected, current, accepted, onSelect }) {
  const { t, format } = useI18n();
  if (revisions.length < 2) return null;
  return (
    <div className="agreement-revisions" role="group" aria-label={t('agreements.revisions.label')}>
      {revisions.map((revision) => (
        <button
          key={revision.number}
          type="button"
          aria-pressed={revision.number === selected}
          onClick={() => onSelect(revision.number)}
        >
          <strong>{t('agreements.revisions.number', { number: revision.number })}</strong>
          <small>
            {revision.number === accepted
              ? t('agreements.revisions.accepted')
              : revision.number === current
                ? t('agreements.revisions.current')
                : format.date(revision.createdAt)}
          </small>
        </button>
      ))}
    </div>
  );
}

/**
 * The evidence for the revision on screen (docs/agreements-design.md §3): who wrote it,
 * when it was sealed and its SHA-256 digest, plus the acceptance and any approval (§17).
 */
export function AgreementEvidence({ agreement, revision, total, acceptance, events }) {
  const { t, format } = useI18n();
  const approval = approvalOf(events, revision.number);
  return (
    <section className="agreement-evidence" aria-labelledby="agreement-evidence-title">
      <h3 id="agreement-evidence-title">{t('agreements.evidence.title')}</h3>
      <p className="agreement-muted">{t('agreements.evidence.body')}</p>
      <dl>
        <div>
          <dt>{t('agreements.evidence.revision')}</dt>
          <dd>{t('agreements.evidence.revisionOf', { number: revision.number, total })}</dd>
        </div>
        <div>
          <dt>{t('agreements.evidence.author')}</dt>
          <dd>{nameOf(agreement, revision.authorParty, t)}</dd>
        </div>
        {revision.createdAt && (
          <div>
            <dt>{t('agreements.evidence.sealed')}</dt>
            <dd>{format.dateTime(revision.createdAt)}</dd>
          </div>
        )}
        {acceptance?.revision === revision.number && (
          <div>
            <dt>{t('agreements.evidence.accepted')}</dt>
            <dd>
              {t('agreements.evidence.acceptedBy', {
                name: nameOf(agreement, acceptance.party, t),
                date: format.dateTime(acceptance.at),
              })}
            </dd>
          </div>
        )}
        {approval && (
          <div>
            <dt>{t('handoverOffer.evidenceApproved')}</dt>
            <dd>
              {t(approvalKey(approval, events))}
              <small>{`\n${format.dateTime(approval.at)}`}</small>
            </dd>
          </div>
        )}
        <div className="is-wide">
          <dt>{t('agreements.evidence.digest')}</dt>
          <dd>
            <code className="agreement-digest">{revision.digest}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Who did what and when, oldest first; the server leaves out actor IDs and terms. */
export function AgreementHistory({ agreement, events }) {
  const { t, format } = useI18n();
  if (!events?.length) return null;
  return (
    <section className="agreement-history" aria-labelledby="agreement-history-title">
      <h3 id="agreement-history-title">{t('agreements.history.title')}</h3>
      <ol>
        {events.map((event, index) => (
          <li key={`${event.action}-${event.at}-${index}`}>
            <span>
              {event.action === 'approved'
                ? t(approvalKey(event, events))
                : t(`agreements.event.${event.action}`, {
                    name: nameOf(agreement, event.party || 'sender', t),
                  })}
            </span>
            <small>
              {event.revision
                ? t('agreements.history.revisionAt', {
                    number: event.revision,
                    date: format.dateTime(event.at),
                  })
                : format.dateTime(event.at)}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}

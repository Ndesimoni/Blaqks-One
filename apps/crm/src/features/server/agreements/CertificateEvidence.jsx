import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementTerms, Facts } from './AgreementTerms.jsx';

/** Full terms remain readable; the exact stable evidence and digest recipe stay available. */
export function CertificateEvidence({ certificate }) {
  const { t, format } = useI18n();
  const { evidence, display, digestInstructions } = certificate;
  const parties = display.agreement.parties;
  const names = Object.fromEntries(
    ['sender', 'recipient'].map((side) => [side, parties?.[side]?.name]),
  );
  const actorName = (id) =>
    display.actors.find((actor) => actor.id === id)?.name || t('agreements.party.unknown');
  return (
    <article className="agreement-certificate-content">
      <Facts
        title={evidence.agreement.id}
        rows={['sender', 'recipient'].map((side) => [
          t(`agreements.party.${side}`),
          `${names[side]} · ${parties?.[side]?.company || ''}`,
        ])}
      />
      {evidence.revisions.map((revision) => (
        <section key={revision.id} className="certificate-revision">
          <h3>{t('agreements.revisions.number', { number: revision.number })}</h3>
          <p>
            {names[revision.authorParty] || revision.authorParty} ·{' '}
            {format.dateTime(revision.createdAt)}
          </p>
          <AgreementTerms terms={revision.terms} names={names} />
          <p>{t('agreements.evidence.digest')}</p>
          <code className="agreement-digest">{revision.digest}</code>
        </section>
      ))}
      <section>
        <h3>{t('agreements.history.title')}</h3>
        <ol className="agreement-payment-list">
          {evidence.actions.map((action) => (
            <li key={action.id}>
              <strong>{actorName(action.actorId)}</strong>
              <span>
                {action.action} · {action.party} · {action.verification}
              </span>
              <time>{format.dateTime(action.createdAt)}</time>
              {action.acceptedDigest && (
                <code className="agreement-digest">{action.acceptedDigest}</code>
              )}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3>{t('agreementLifecycle.evidence')}</h3>
        <pre className="certificate-json">
          {JSON.stringify({ evidence, digestInstructions }, null, 2)}
        </pre>
      </section>
    </article>
  );
}

import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The commitments and the separate publication consent, each its own tick, and the terms
 * readable in full with the draft notice visible (broker marketplace §2, amendment 3).
 * `part` selects the step that is showing.
 */
export function JoinTerms({ terms, ticks, consent, onTick, onConsent, part }) {
  const { t } = useI18n();
  if (part === 'terms')
    return (
      <section className="market-step">
        <h3>
          {t('marketplaceJoin.join.termsTitle')} · {terms.version}
        </h3>
        {terms.draft && <p className="market-reason">{t('marketplaceJoin.join.draft')}</p>}
        <div
          className="market-terms"
          tabIndex={0}
          aria-label={t('marketplaceJoin.join.termsTitle')}
        >
          {terms.body}
        </div>
      </section>
    );
  return (
    <>
      <section className="market-step">
        <h3>{t('marketplaceJoin.join.commitments')}</h3>
        <ul className="market-checklist">
          {terms.commitments.map((line, index) => (
            <li key={line} className="is-met">
              <label className="market-check">
                <input
                  type="checkbox"
                  checked={ticks[index] === true}
                  onChange={() => onTick(index)}
                />
                <span>{line}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className="market-step">
        <h3>{t('marketplaceJoin.join.consentTitle')}</h3>
        <label className="market-check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => onConsent(event.target.checked)}
          />
          <span>{terms.consent}</span>
        </label>
      </section>
    </>
  );
}

import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The card above the company's checklist and the join card (marketplace redesign): what the
 * marketplace keeps private, worded as the design review asked (finding 24). `children` adds
 * the state's own sentence.
 */
export function MarketplaceIntro({ children }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className="market-card market-intro" aria-labelledby={id}>
      <h2 id={id}>{t('marketplace.introTitle')}</h2>
      <p>{t('marketplace.privacy')}</p>
      {children}
    </section>
  );
}

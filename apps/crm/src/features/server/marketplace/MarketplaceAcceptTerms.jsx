import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { JoinTerms } from './JoinTerms.jsx';

/**
 * A newer terms version (packet MK1b): the member reads it in full and, as when joining, ticks
 * every commitment and the publication consent again (MK1 code review M4) before they can
 * post, answer or edit. The banner on their profile opens this.
 */
export function MarketplaceAcceptTerms({ terms, busy, error, onAccept, onClose }) {
  const { t } = useI18n();
  const [ticks, setTicks] = useState(() => terms.commitments.map(() => false));
  const [consent, setConsent] = useState(false);
  const ready = consent && ticks.every(Boolean);
  const tick = (index) =>
    setTicks((now) => now.map((value, at) => (at === index ? !value : value)));
  return (
    <FinanceDialog
      title={t('marketplaceJoin.mine.termsTitle', { version: terms.version })}
      intro={t('marketplaceJoin.mine.termsIntro')}
      busy={busy}
      message={error}
      onClose={onClose}
      onSubmit={() => onAccept({ commitments: ticks, consent })}
      submitDisabled={!ready}
      submitLabel={busy ? t('marketplaceJoin.mine.accepting') : t('marketplaceJoin.mine.accept')}
      wide
    >
      <JoinTerms terms={terms} part="terms" />
      <JoinTerms
        terms={terms}
        ticks={ticks}
        consent={consent}
        onTick={tick}
        onConsent={setConsent}
      />
    </FinanceDialog>
  );
}

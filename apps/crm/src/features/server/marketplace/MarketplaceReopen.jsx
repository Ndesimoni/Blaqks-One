import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Reopening never cancels an accepted agreement; the server publishes the capability. */
export function MarketplaceReopen({ request, busy, onReopen }) {
  const { t } = useI18n();
  if (!request.isPoster || request.state !== 'paused') return null;
  if (request.canReopen === false)
    return <p className="market-hint">{t('marketplaceAgreement.reopenBlocked')}</p>;
  return (
    <Button variant="light" disabled={busy} onClick={onReopen}>
      {t('marketplaceAnswers.reopen')}
    </Button>
  );
}

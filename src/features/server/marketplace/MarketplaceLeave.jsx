import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';

/** Leaving the marketplace asks once; the profile and photo go at once, the evidence stays. */
export function MarketplaceLeave({ busy, error, onLeave, onClose }) {
  const { t } = useI18n();
  return (
    <FinanceDialog
      title={t('marketplaceJoin.mine.leaveTitle')}
      intro={t('marketplaceJoin.mine.leaveIntro')}
      busy={busy}
      message={error}
      onClose={onClose}
      onSubmit={onLeave}
      submitLabel={busy ? t('marketplaceJoin.mine.leaving') : t('marketplaceJoin.mine.leave')}
      danger
      className="market-dialog-short"
    />
  );
}

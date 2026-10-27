import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';

export function MarketplaceDecisionDialog({ decision, busy, error, onClose, onSubmit }) {
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  return (
    <FinanceDialog
      title={k(`${decision.action}Title`)}
      intro={k(`${decision.action}Text`)}
      busy={busy}
      message={error}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={k('submit')}
    >
      <p className="market-hint">{k('privacy')}</p>
    </FinanceDialog>
  );
}

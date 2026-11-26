import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The member's own everyday profile actions (packet MK1b): edit, photo and preview in one row,
 * with the photo's or the save's error below. Leaving sits apart, on the card's last row.
 */
export function MarketplaceMineActions({ mine, hasPhoto, onPreview }) {
  const { t } = useI18n();
  const busy = Boolean(mine.busy);
  return (
    <div className="market-profile-actions">
      <div className="market-actions">
        <Button variant="light" onClick={() => mine.setEditing(true)}>
          {t('marketplaceJoin.mine.edit')}
        </Button>
        <Button variant="light" onClick={() => mine.files.current?.click()} disabled={busy}>
          {hasPhoto ? t('marketplaceJoin.mine.photoChange') : t('marketplaceJoin.mine.photoAdd')}
        </Button>
        {hasPhoto && (
          <Button variant="light" onClick={mine.removePhoto} disabled={busy}>
            {t('marketplaceJoin.mine.photoRemove')}
          </Button>
        )}
        <Button variant="light" onClick={onPreview}>
          {t('marketplaceJoin.mine.preview')}
        </Button>
      </div>
      {mine.error && (
        <p className="field-error" role="alert">
          {mine.error}
        </p>
      )}
    </div>
  );
}

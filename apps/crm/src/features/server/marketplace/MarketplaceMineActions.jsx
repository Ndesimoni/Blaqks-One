import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The member's own profile actions (packet MK1b): edit, photo and preview in one row, and
 * leaving the marketplace on its own row below a hairline, apart from the everyday actions.
 */
export function MarketplaceMineActions({ mine, hasPhoto, onPreview, onLeave }) {
  const { t } = useI18n();
  const busy = Boolean(mine.busy);
  return (
    <>
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
      <div className="market-leave">
        <Button variant="danger-light" onClick={onLeave}>
          {t('marketplaceJoin.mine.leave')}
        </Button>
      </div>
    </>
  );
}

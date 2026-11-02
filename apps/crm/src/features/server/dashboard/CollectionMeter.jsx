import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { formatAed } from '../../../lib/finance/money.js';
import { collectedShare } from './financeDashboard.js';

/**
 * The finance panel's collected meter (dataviz meter: the fill in the bar hue, the track a
 * lighter step of it): the share of fees due that has been received, with the amounts written
 * beside it so the bar is never read alone. Hidden until a fee is due.
 */
export function CollectionMeter({ overview }) {
  const { t } = useI18n();
  const share = collectedShare(overview);
  if (share.dueFils === 0n) return null;
  return (
    <div className="collection-meter">
      <div className="collection-meter-text">
        <strong>{t('dashboard.collectedShare', { percent: share.percent })}</strong>
        <span>
          {t('dashboard.collectedOf', {
            received: formatAed(share.receivedFils),
            due: formatAed(share.dueFils),
          })}
        </span>
      </div>
      <div
        className="collection-meter-track"
        role="meter"
        aria-label={t('dashboard.collected')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share.percent}
      >
        <span style={{ width: `${share.percent}%` }} />
      </div>
    </div>
  );
}

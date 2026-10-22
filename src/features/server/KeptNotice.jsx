import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import './kept-notice.css';

/**
 * The badge on a handed-over client or listing the caller still reads (agreements design
 * §18): who received it, when, for which deal and on what terms. The record is view only.
 */
export function KeptNotice({ badge }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`recordKeeps.${key}`, vars);
  const share =
    badge.kind === 'referral'
      ? k('referral', { share: format.percent(badge.referralShareBp) })
      : k('full');
  const facts = {
    name: badge.other.name,
    date: format.date(badge.at),
    dealId: badge.dealId,
    share,
  };
  return (
    <p className="record-kept-notice" role="note">
      <strong>{k('viewOnly')}</strong>{' '}
      {k(badge.reason === 'shared' ? 'shared' : 'handedOver', facts)}
    </p>
  );
}

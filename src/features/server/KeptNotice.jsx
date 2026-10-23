import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import './kept-notice.css';

const wording = { handed_over: 'handedOver', shared: 'shared', colleague: 'colleague' };

/**
 * The badge on a record the caller reads but does not hold: a handed-over client or listing
 * (agreements design §18) — who received it, when, for which deal and on what terms — or a
 * colleague's shared copy (record sharing R1) — who shared it and when. It is view only.
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
      <strong>{k('viewOnly')}</strong> {k(wording[badge.reason] || 'handedOver', facts)}
    </p>
  );
}

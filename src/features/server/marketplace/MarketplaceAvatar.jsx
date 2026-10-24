import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || '?';

/**
 * A broker's marketplace photo as a round avatar, or their initials when they have no photo
 * or it cannot be shown (broker marketplace MK1).
 */
export function MarketplaceAvatar({ name, src }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <span className="market-avatar is-initials" aria-hidden="true">
        {initials(name)}
      </span>
    );
  return (
    <img
      className="market-avatar"
      alt={t('marketplaceJoin.profile.photoAlt', { name })}
      src={src}
      onError={() => setFailed(true)}
    />
  );
}

/** The avatar beside the broker's name and company, at the top of a profile. */
export function MarketplacePerson({ name, company, src }) {
  return (
    <div className="market-person">
      <MarketplaceAvatar name={name} src={src} />
      <div>
        <strong>{name}</strong>
        {company && <span>{company}</span>}
      </div>
    </div>
  );
}

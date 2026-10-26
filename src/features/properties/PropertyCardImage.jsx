import React, { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useMediaSource } from '../../lib/mediaSource.js';
import { get } from '../../lib/records.js';
import { useI18n } from '../../i18n/useI18n.js';

export function PropertyCardImage({ property, cover, hasPhotos, index }) {
  const source = useMediaSource();
  const src = cover.demo ? cover.src : source.src(cover, property);
  const title = get(property, 'Listing title') || 'Property';
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`property-photo variant-${index % 4}`}>
      {failed ? (
        <div
          className="property-photo-fallback"
          role="img"
          aria-label={t('properties.photoUnavailableFor', { property: title })}
        >
          <Icon name="image" size={24} />
          <span>{t('properties.photoUnavailable')}</span>
        </div>
      ) : (
        <img
          className={hasPhotos ? 'property-cover-img' : 'property-demo-cover'}
          src={src}
          alt={hasPhotos && !cover.demo ? `${title} cover` : cover.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

import React from 'react';
import { isCommercialProperty, listingIntent, propertyPrice } from '../../lib/properties.js';
import { get } from '../../lib/records.js';
import { mediaPhotos } from '../../lib/media.js';
import { demoListingPhoto } from '../../lib/demoPropertyPhotos.js';
import { N } from '../../lib/format.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { KeptChip } from '../records/KeptChip.jsx';
import { PropertyCardImage } from './PropertyCardImage.jsx';
import { useI18n } from '../../i18n/useI18n.js';

export function PropertyCard({ property: p, index: i, onSelect }) {
  const { t } = useI18n();
  const photos = mediaPhotos(p);
  const cover = photos[0] || demoListingPhoto(p);
  return (
    <button className="property-card modern-property-card" type="button" onClick={onSelect}>
      <div className="property-card-media">
        <PropertyCardImage
          property={p}
          cover={cover}
          hasPhotos={Boolean(photos.length)}
          index={i}
        />
        <span className="property-intent-tag">
          {listingIntent(p) === 'Holiday home'
            ? 'HOLIDAY HOME'
            : listingIntent(p) === 'Sale'
              ? 'FOR SALE'
              : 'FOR RENT'}
        </span>
        <span className="property-photo-status">
          <Badge>{get(p, 'Listing status') || 'Unspecified'}</Badge>
        </span>
      </div>
      <div className="property-content">
        <div className="property-price">
          <small>ASKING PRICE</small>
          <strong>{propertyPrice(p)}</strong>
        </div>
        <h3>{get(p, 'Listing title') || 'Untitled listing'}</h3>
        <p>
          <Icon name="pin" size={14} />
          {get(p, 'Community') || 'Community not set'} · {get(p, 'Emirate') || 'UAE'}
        </p>
        <div className="property-card-facts">
          <span>
            <Icon name="bed" size={14} />
            {isCommercialProperty(p) && Number(get(p, 'Bedrooms')) === 0
              ? 'Commercial'
              : `${get(p, 'Bedrooms') ?? '—'} beds`}
          </span>
          {get(p, 'Bathrooms') && (
            <span>
              <Icon name="bath" size={14} />
              {get(p, 'Bathrooms')} baths
            </span>
          )}
          <span>
            <Icon name="grid" size={14} />
            {get(p, 'Area sq ft') ? N(get(p, 'Area sq ft')) + ' sqft' : 'Area TBD'}
          </span>
          {listingIntent(p) === 'Holiday home' && get(p, 'Maximum guests') && (
            <span>
              <Icon name="users" size={14} />
              {get(p, 'Maximum guests')} guests
            </span>
          )}
        </div>
        <div className="property-card-meta">
          <span>{get(p, 'Property type') || 'Property'}</span>
          <span>{get(p, 'Ready / off-plan') || 'Ready'}</span>
          <KeptChip module="Properties" record={p} />
          {(!photos.length || cover.demo) && (
            <span className="property-demo-label">Demo photo</span>
          )}
          {photos.length > 0 && (
            <span className="photo-count">
              <Icon name="image" size={12} /> {photos.length}
            </span>
          )}
        </div>
        <div className="property-bottom">
          <span>{t('properties.open')}</span>
          <Icon name="arrow" size={18} />
        </div>
      </div>
    </button>
  );
}

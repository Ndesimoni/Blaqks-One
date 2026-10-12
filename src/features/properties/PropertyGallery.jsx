import { mediaPhotos } from '../../lib/media.js';
import { get } from '../../lib/records.js';
import { Icon } from '../../components/ui/Icon.jsx';
import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { PropertyDemoPreview } from './PropertyDemoPreview.jsx';

function PropertyGallery({ record, onEdit }) {
  const photos = mediaPhotos(record);
  return (
    <div className="media-gallery-strip">
      {photos.length ? (
        <div className="media-photo-hero">
          <a
            href={photos[0].src}
            target="_blank"
            rel="noopener noreferrer"
            title="Open cover photo"
          >
            <img
              src={photos[0].src}
              alt={
                photos[0].demo
                  ? photos[0].name
                  : `${get(record, 'Listing title') || 'Property'} main photo`
              }
            />
          </a>
          <span>
            <Icon name="image" size={16} />
            {photos[0].demo
              ? 'Demo photo'
              : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          </span>
        </div>
      ) : (
        <PropertyDemoPreview record={record} onEdit={onEdit} />
      )}
      {photos.length > 1 && (
        <OverflowList
          mode="scroll"
          className="photo-strip"
          items={photos.slice(1)}
          label="Property photo thumbnails"
          listClassName="media-photo-thumbs"
          renderItem={(p, i) => (
            <a
              href={p.src}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open property photo ${i + 2}`}
            >
              <img src={p.src} alt={`Property photo ${i + 2}`} />
            </a>
          )}
        />
      )}
    </div>
  );
}

export { PropertyGallery };

import { mediaPhotos } from '../../lib/media.js';
import { get } from '../../lib/records.js';
import { Icon } from '../../components/ui/Icon.jsx';
import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { PropertyDemoPreview } from './PropertyDemoPreview.jsx';
import { useMediaSource } from '../../lib/mediaSource.js';

function PropertyGallery({ record, onEdit }) {
  const photos = mediaPhotos(record);
  const source = useMediaSource();
  return (
    <div className="media-gallery-strip">
      {photos.length ? (
        <div className="media-photo-hero">
          <a
            href={source.full(photos[0], record)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open cover photo"
          >
            <img
              src={source.full(photos[0], record)}
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
              href={source.full(p, record)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open property photo ${i + 2}`}
            >
              <img src={source.src(p, record)} alt={`Property photo ${i + 2}`} />
            </a>
          )}
        />
      )}
    </div>
  );
}

export { PropertyGallery };

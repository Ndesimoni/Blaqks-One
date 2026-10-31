import React from 'react';
import { demoListingPhoto } from '../../lib/demoPropertyPhotos.js';

export function PropertyDemoPreview({ record, onEdit }) {
  const sample = demoListingPhoto(record);
  return (
    <div className="property-demo-preview">
      <img src={sample.src} alt={`${sample.name}, sample image`} loading="lazy" />
      <div className="property-demo-caption">
        <div>
          <strong>Demo photo</strong>
          <span>Add actual photos before publishing this listing.</span>
        </div>
        {onEdit && (
          <button className="btn" type="button" onClick={onEdit}>
            Add property photos
          </button>
        )}
      </div>
    </div>
  );
}

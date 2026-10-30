import React from 'react';
import { mediaPhotos, mediaPlans } from '../../lib/media.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

import { useMediaSource } from '../../lib/mediaSource.js';
import { usePropertyMediaEditor } from './usePropertyMediaEditor.js';
import { PropertyAmenityPicker } from './PropertyAmenityPicker.jsx';
import { useI18n } from '../../i18n/useI18n.js';

export function PropertyMediaEditor({
  form,
  setForm,
  uploading,
  setUploading,
  storageMode = 'browser',
}) {
  const source = useMediaSource();
  const { t } = useI18n();
  const { mediaError, addMedia, removeMedia } = usePropertyMediaEditor({
    form,
    setForm,
    setUploading,
  });
  return (
    <section className="editor-media">
      <div className="editor-media-heading">
        <div>
          <span className="eyebrow">LISTING PRESENTATION</span>
          <h3>Photos & floor plans</h3>
          <p>Make your property attractive, complete and easy to share.</p>
        </div>
        <Badge tone="slate">{storageMode === 'server' ? 'CRM storage' : 'Browser storage'}</Badge>
      </div>
      <OverflowList
        mode="all"
        items={mediaPhotos(form)}
        label="Property photos"
        listClassName="editor-photo-grid"
        renderItem={(file, i) => (
          <div className="editor-photo">
            <img src={source.src(file, form)} alt={file.name} />
            {i === 0 && <span className="cover-marker">Cover photo</span>}
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => removeMedia('media_photos', i)}
            >
              <Icon name="close" size={14} />
            </button>
            {i > 0 && (
              <button
                type="button"
                className="make-cover"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    media_photos: [p.media_photos[i], ...p.media_photos.filter((_, j) => j !== i)],
                  }))
                }
              >
                Set cover
              </button>
            )}
          </div>
        )}
        after={
          <label className="media-upload-tile">
            <Icon name="image" size={22} />
            <strong>{uploading ? 'Processing...' : 'Add photos'}</strong>
            <small>
              {source.stored
                ? t('properties.photoLimit', { limit: 20 })
                : 'JPG, PNG, WebP · up to 8'}
            </small>
            <input
              aria-label="Upload property photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={(e) => addMedia(e, 'photo')}
            />
          </label>
        }
      />
      <div className="editor-floorplans">
        <div className="editor-subheading">
          <Icon name="layers" size={17} /> Floor plans <span>Up to 3 files</span>
        </div>
        {mediaPlans(form).map((file, i) => (
          <div className="editor-plan" key={i}>
            <Icon name={file.type === 'application/pdf' ? 'note' : 'image'} size={16} />
            <span>{file.name}</span>
            <button
              type="button"
              aria-label={`Remove floor plan ${i + 1}`}
              onClick={() => removeMedia('media_floorplans', i)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <label className="media-attach-button">
          <Icon name="plus" size={16} /> Add floor plan (image or PDF)
          <input
            aria-label="Upload floor plans"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            disabled={uploading}
            onChange={(e) => addMedia(e, 'plan')}
          />
        </label>
      </div>
      {mediaError && (
        <p className="media-warning" role="alert">
          {mediaError}
        </p>
      )}
      <p className="media-note">
        {storageMode === 'server'
          ? 'Photos and floor plans are saved with this property in your private CRM workspace.'
          : 'Files are optimized for local storage. Use “Full backup with photos” in Data & export; standard Excel export includes listing text only.'}
      </p>
      <PropertyAmenityPicker form={form} setForm={setForm} />
    </section>
  );
}

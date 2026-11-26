import React, { useId } from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { useMediaSource } from '../../../../lib/mediaSource.js';
import { MAX_PHOTOS, makeCover, photoChoices, toggle } from './publishModel.js';

/**
 * Stored photos only, in a bounded grid of toggle buttons. Every photo starts selected (up
 * to 20); the first selected one is the cover, and "Set as cover" moves another first.
 * The counter is announced politely as the selection changes.
 */
export function PublishPhotos({ flow }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const source = useMediaSource();
  const id = useId();
  const { draft, change, errors } = flow;
  const record = flow.entry?.record;
  const photos = photoChoices(record);
  // Photos added in the editor but not yet saved have no stored file to publish.
  const unsaved = (record?.media_photos || []).length > photos.length;
  const name = (number, position) =>
    k(position === 0 ? 'photoCover' : position > 0 ? 'photoSelected' : 'photoUnselected', {
      number,
    });
  return (
    <section className="website-media" aria-labelledby={`${id}-title`}>
      <div className="website-media-head">
        <h4 id={`${id}-title`}>{k('photos')}</h4>
        <p aria-live="polite">{k('photoCount', { count: draft.photos.length, max: MAX_PHOTOS })}</p>
      </div>
      {photos.length > 0 ? (
        <ul className="website-photo-grid">
          {photos.map((photo, index) => {
            const position = draft.photos.indexOf(photo.file);
            return (
              <li key={photo.file} className={position >= 0 ? 'is-selected' : ''}>
                <button
                  type="button"
                  className="website-photo-toggle"
                  aria-pressed={position >= 0}
                  aria-label={name(index + 1, position)}
                  aria-invalid={index === 0 && Boolean(errors.photos)}
                  onClick={() => change({ photos: toggle(draft.photos, photo.file, MAX_PHOTOS) })}
                >
                  <img src={source.src(photo, record)} alt="" loading="lazy" />
                  <span className="website-photo-mark" aria-hidden="true">
                    {position === 0 ? k('cover') : position > 0 ? position + 1 : ''}
                  </span>
                </button>
                {position > 0 && (
                  <button
                    type="button"
                    className="website-photo-cover"
                    aria-label={k('setCoverNamed', { number: index + 1 })}
                    onClick={() => change({ photos: makeCover(draft.photos, photo.file) })}
                  >
                    {k('setCover')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="website-publish-note">{k('noPhotos')}</p>
      )}
      {unsaved && <small className="finance-hint">{k('unsavedPhotos')}</small>}
      {errors.photos && (
        <p className="field-error" role="alert">
          {k('photosRequired')}
        </p>
      )}
    </section>
  );
}

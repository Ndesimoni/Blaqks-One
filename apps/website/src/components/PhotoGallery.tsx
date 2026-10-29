'use client';

import { useRef } from 'react';

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const images = photos.filter(Boolean);
  if (!images.length)
    return <p className="notice">Photos have not been supplied for this property.</p>;
  return (
    <>
      <div className="detail-gallery">
        <button
          className="gallery-cover"
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-label={`View all ${images.length} photos of ${title}`}
        >
          <img src={images[0]} alt={title} width="1400" height="900" fetchPriority="high" />
          <span>View all {images.length} photos →</span>
        </button>
        {images.length > 1 && (
          <div className="gallery-side">
            {images.slice(1, 3).map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => dialog.current?.showModal()}
                aria-label={`Open photo ${index + 2}`}
              >
                <img src={image} alt={`${title}, photo ${index + 2}`} width="700" height="450" />
              </button>
            ))}
          </div>
        )}
      </div>
      <dialog className="photo-dialog" ref={dialog} aria-label={`Property photos: ${title}`}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="button quiet" onClick={() => dialog.current?.close()}>
            Close gallery
          </button>
        </header>
        <p>{images.length} property photos</p>
        <div>
          {images.map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image}
              alt={`${title}, photo ${index + 1} of ${images.length}`}
              width="1400"
              height="900"
              loading="lazy"
            />
          ))}
        </div>
      </dialog>
    </>
  );
}

import { get } from './records.js';
import { mediaPhotos, makeMediaAsset } from './media.js';
import { isCommercialProperty } from './properties.js';

const cachedAssets = new Map();
const samples = {
  apartment: { src: '/demo/apartment-interior.jpg', name: 'Demo apartment interior' },
  villa: { src: '/demo/villa-exterior.jpg', name: 'Demo villa exterior' },
  office: { src: '/demo/commercial-office.jpg', name: 'Demo commercial office' },
};

export function demoListingPhoto(record) {
  if (isCommercialProperty(record)) return samples.office;
  const type = String(get(record, 'Property type') || '').toLowerCase();
  return /villa|townhouse/.test(type) ? samples.villa : samples.apartment;
}

async function loadSample(sample) {
  if (!cachedAssets.has(sample.src)) {
    const pending = (async () => {
      const response = await fetch(sample.src);
      if (!response.ok) throw Error('Demo photo could not load. Retry or turn off demo photos.');
      const blob = await response.blob();
      const file = new File([blob], `${sample.name}.jpg`, { type: blob.type });
      const { added: _added, ...asset } = await makeMediaAsset(file, 'photo');
      return { ...asset, demo: true, source: 'generated-demo' };
    })();
    cachedAssets.set(sample.src, pending);
    pending.catch(() => cachedAssets.delete(sample.src));
  }
  return cachedAssets.get(sample.src);
}

// Samples are embedded only in the import copy, never written to the browser source.
export async function attachDemoListingPhotos(records, loadAsset = loadSample) {
  const properties = await Promise.all(
    records.Properties.map(async (property) => {
      if (mediaPhotos(property).length) return property;
      const asset = await loadAsset(demoListingPhoto(property));
      return { ...property, media_photos: [{ ...asset }] };
    }),
  );
  return { ...records, Properties: properties };
}

import { today } from '../../../lib/dates.js';

const PHOTO = ['image/jpeg', 'image/png', 'image/webp'];
const FULL_EDGE = 2048;
const THUMB_EDGE = 480;

/** The image redrawn as a JPEG no larger than `edge` on its long side (drops metadata). */
async function resized(file, edge, quality) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(Error('This image could not be read.'));
      image.src = url;
    });
    const factor = Math.min(1, edge / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * factor));
    canvas.height = Math.max(1, Math.round(image.height * factor));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('This image could not be prepared.'))),
        'image/jpeg',
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const named = (blob, name) => new File([blob], name, { type: blob.type });

/**
 * Uploads one photo (a 2048px copy and a 480px thumbnail) or one floor plan (images as
 * photos, PDFs as they are) to private storage. `remember` keeps a local preview for files
 * the record has not saved yet. Returns the record's media entry.
 */
export async function storeAsset(api, workspaceId, file, kind, remember) {
  const photo = PHOTO.includes(file.type);
  if (!photo && !(kind === 'plan' && file.type === 'application/pdf'))
    throw Error('Use JPEG, PNG or WebP images; floor plans may also be PDFs.');
  if (file.size > 20 * 1024 * 1024) throw Error('Each file must be smaller than 20 MB.');
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  if (!photo) {
    const { media } = await api.uploadMedia(workspaceId, file);
    return { name: media.name, type: file.type, added: today(), file: media.id };
  }
  const [full, thumb] = await Promise.all([
    resized(file, FULL_EDGE, 0.85),
    resized(file, THUMB_EDGE, 0.8),
  ]);
  const [stored, small] = await Promise.all([
    api.uploadMedia(workspaceId, named(full, `${base}.jpg`)),
    api.uploadMedia(workspaceId, named(thumb, `${base}-small.jpg`)),
  ]);
  remember(stored.media.id, full);
  remember(small.media.id, thumb);
  const entry = {
    name: stored.media.name,
    type: 'image/jpeg',
    added: today(),
    file: stored.media.id,
  };
  return kind === 'photo' ? { ...entry, thumb: small.media.id } : entry;
}

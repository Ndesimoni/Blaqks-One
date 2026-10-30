import { today } from './dates.js';

const mediaPhotos = (r) => (Array.isArray(r?.media_photos) ? r.media_photos : []);

const mediaPlans = (r) => (Array.isArray(r?.media_floorplans) ? r.media_floorplans : []);

const fileToData = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

async function optimizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    let factor = Math.min(1, 1200 / Math.max(img.width, img.height));
    let quality = 0.78;
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(img.width * factor));
      canvas.height = Math.max(1, Math.round(img.height * factor));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL('image/jpeg', quality);
      if (src.length < 205000) return src;
      factor *= 0.82;
      quality = Math.max(0.48, quality - 0.06);
    }
    return canvas.toDataURL('image/jpeg', 0.52);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeMediaAsset(file, kind) {
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!isImage && !(kind === 'plan' && file.type === 'application/pdf'))
    throw Error('Use JPEG, PNG or WebP images; floor plans may also be PDFs.');
  if (file.size > 12 * 1024 * 1024) throw Error('Each file must be smaller than 12 MB.');
  if (!isImage && file.size > 450 * 1024)
    throw Error('Please use a PDF smaller than 450 KB for browser storage.');
  return {
    name: file.name,
    type: isImage ? 'image/jpeg' : file.type,
    src: isImage ? await optimizeImage(file) : await fileToData(file),
    added: today(),
  };
}

export { mediaPhotos, mediaPlans, fileToData, optimizeImage, makeMediaAsset };

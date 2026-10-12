import { useState } from 'react';
import { makeMediaAsset } from '../../lib/media.js';
import { MAX_MEDIA_TOTAL } from '../../config/storage.js';

export function usePropertyMediaEditor({ form, setForm, setUploading }) {
  const [mediaError, setMediaError] = useState('');
  async function addMedia(e, kind) {
    const input = e.currentTarget;
    const selected = Array.from(input.files || []);
    if (!selected.length) return;
    const field = kind === 'photo' ? 'media_photos' : 'media_floorplans';
    const max = kind === 'photo' ? 8 : 3;
    const current = Array.isArray(form[field]) ? form[field] : [];
    if (current.length + selected.length > max) {
      setMediaError(`Maximum ${max} ${kind === 'photo' ? 'photos' : 'floor plans'} per property.`);
      input.value = '';
      return;
    }
    setUploading(true);
    setMediaError('');
    try {
      const assets = [];
      for (const file of selected) assets.push(await makeMediaAsset(file, kind));
      const updated = [...current, ...assets];
      if (JSON.stringify({ ...form, [field]: updated }).length > MAX_MEDIA_TOTAL / 1.6)
        throw Error('Media exceeds the listing limit. Try fewer or smaller files.');
      setForm((p) => ({ ...p, [field]: updated }));
    } catch (err) {
      setMediaError(err.message);
    } finally {
      setUploading(false);
      input.value = '';
    }
  }
  function removeMedia(key, index) {
    setForm((p) => ({ ...p, [key]: (p[key] || []).filter((_, i) => i !== index) }));
  }
  return { mediaError, addMedia, removeMedia };
}

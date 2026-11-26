import { useState } from 'react';

export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX = 10;

/**
 * Files chosen in the composer (packet F1): each uploads at once as the member's private
 * pending upload; sending attaches the uploaded ones. A failed upload shows its reason.
 */
export function useAttachments(api, workspaceId) {
  const [items, setItems] = useState([]);
  const update = (key, change) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  const add = (files) => {
    const room = Math.max(0, MAX - items.length);
    for (const file of [...files].slice(0, room)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setItems((current) => [...current, { key, name: file.name, status: 'uploading' }]);
      api
        .uploadMedia(workspaceId, file)
        .then(({ media }) => update(key, { status: 'ready', id: media.id }))
        .catch((failure) => update(key, { status: 'failed', error: failure.message }));
    }
  };
  return {
    items,
    add,
    remove: (key) => setItems((current) => current.filter((item) => item.key !== key)),
    clear: () => setItems([]),
    ids: items.filter((item) => item.status === 'ready').map((item) => item.id),
    busy: items.some((item) => item.status === 'uploading'),
    full: items.length >= MAX,
  };
}

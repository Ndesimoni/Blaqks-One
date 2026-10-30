import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { MediaSourceContext } from '../../../lib/mediaSource.js';
import { storeAsset } from './storedAssets.js';

/**
 * Connected property media (packet F2): new photos and floor plans upload to private
 * storage, and stored ones load through the record's protected file route. Files not yet
 * saved with their property show from a local preview.
 */
export function ServerMediaProvider({ api, workspaceId, entries, children }) {
  const previews = useRef(new Map());
  useEffect(
    () => () => {
      for (const url of previews.current.values()) URL.revokeObjectURL(url);
    },
    [],
  );
  const remember = useCallback((id, blob) => {
    previews.current.set(id, URL.createObjectURL(blob));
  }, []);
  const urlOf = useCallback(
    (id, record) => {
      if (!id) return '';
      if (previews.current.has(id)) return previews.current.get(id);
      const key = record?.property_id;
      const entry = (entries?.Properties || []).find((item) => item.record.property_id === key);
      if (!entry) return '';
      return `/api/crm/workspaces/${encodeURIComponent(workspaceId)}/records/Properties/${encodeURIComponent(entry.id)}/files/${encodeURIComponent(id)}`;
    },
    [entries, workspaceId],
  );
  const value = useMemo(
    () => ({
      stored: true,
      src: (asset, record) => asset?.src || urlOf(asset?.thumb || asset?.file, record),
      full: (asset, record) => asset?.src || urlOf(asset?.file, record),
      makeAsset: (file, kind) => storeAsset(api, workspaceId, file, kind, remember),
    }),
    [api, workspaceId, urlOf, remember],
  );
  return <MediaSourceContext.Provider value={value}>{children}</MediaSourceContext.Provider>;
}

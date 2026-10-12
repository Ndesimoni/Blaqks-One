import { useEffect, useRef, useState } from 'react';
import { attachDemoListingPhotos } from '../../lib/demoPropertyPhotos.js';
import { validateImportPreview, validateImportResult } from './importModel.js';

export function useImportFlow(api, draft) {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setPreview(null);
    setError('');
  }, [draft.source, draft.targetId, draft.demoPhotos]);
  const prepare = async () => {
    if (!draft.source || !draft.targetId || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const records = draft.demoPhotos
        ? await attachDemoListingPhotos(draft.source.records)
        : draft.source.records;
      const response = validateImportPreview(
        await api.previewImport(draft.targetId, {
          sourceWorkspaceId: draft.source.sourceWorkspaceId,
          records,
        }),
      );
      if (alive.current)
        setPreview({ ...response, targetId: draft.targetId, sourceLabel: draft.source.label });
    } catch (failure) {
      if (alive.current) setError(failure.message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const commit = async () => {
    if (!preview || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = validateImportResult(
        await api.commitImport(preview.targetId, preview.token),
      );
      if (alive.current) setResult({ ...response, targetId: preview.targetId });
    } catch (failure) {
      if (alive.current) {
        setError(failure.message);
        if ([400, 409, 410].includes(failure.status)) setPreview(null);
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const clearPreview = () => {
    if (!pending.current) {
      setPreview(null);
      setError('');
    }
  };
  return { preview, result, busy, error, prepare, commit, clearPreview };
}

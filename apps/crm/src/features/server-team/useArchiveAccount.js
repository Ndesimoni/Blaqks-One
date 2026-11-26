import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export function useArchiveAccount(workspaceId, member, onArchived) {
  const { api } = useSession();
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useUnsavedChanges(false, busy);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPreview(null);
    setConfirmation('');
    api
      .archivePreview(workspaceId, member.id, controller.signal)
      .then((result) => {
        if (
          result.member?.id !== member.id ||
          !Number.isSafeInteger(result.member.version) ||
          typeof result.member.email !== 'string' ||
          !/^[a-f0-9]{64}$/.test(result.teamFingerprint) ||
          !Number.isSafeInteger(result.recordCount) ||
          result.recordCount < 0 ||
          !Number.isSafeInteger(result.teamCount) ||
          result.teamCount < 0
        )
          throw Error('The account review was incomplete. Please retry.');
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, member.id, attempt]);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || !preview || confirmation !== preview.member.email) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.archiveMember(workspaceId, member.id, {
        version: preview.member.version,
        confirmationEmail: confirmation,
        teamFingerprint: preview.teamFingerprint,
      });
      onArchived(result);
    } catch (failure) {
      setError(failure.message);
      setPreview(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    preview,
    loading,
    busy,
    error,
    confirmation,
    setConfirmation,
    submit,
    retry: () => setAttempt((value) => value + 1),
  };
}

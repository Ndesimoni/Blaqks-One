import { useRef, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { draftFromProfile, profilePayload, profileProblem } from './joinDraft.js';

/**
 * The joined member's own profile actions (packet MK1b): edit with the version they last saw,
 * upload one image, or remove the photo. Each action re-reads the status on success.
 */
export function useMyProfile(profile, onChanged) {
  const { api, user } = useSession();
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const files = useRef(null);
  const problem = profileProblem(draft);
  const work = async (name, action) => {
    setBusy(name);
    setError('');
    try {
      await action();
      onChanged();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      setBusy('');
    }
  };
  const save = async () => {
    const done = await work('save', () =>
      api.editMarketplaceProfile(user.workspaceId, {
        expectedVersion: profile.version,
        profile: profilePayload(draft),
      }),
    );
    if (done) setEditing(false);
  };
  const upload = async (event) => {
    const chosen = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!chosen) return;
    await work('photo', async () => {
      const uploaded = await api.uploadMarketplacePhoto(user.workspaceId, chosen);
      await api.setMarketplacePhoto(user.workspaceId, uploaded.media.id);
    });
  };
  const removePhoto = () => work('photo', () => api.removeMarketplacePhoto(user.workspaceId));
  const change = (patch) => setDraft((last) => ({ ...last, ...patch }));
  return {
    draft,
    change,
    editing,
    setEditing,
    busy,
    error,
    files,
    problem,
    save,
    upload,
    removePhoto,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { blank } from '../lib/schema.js';
import { workspaceRepository } from '../services/storage/workspaceRepository.js';

export function useWorkspaceData(repository = workspaceRepository) {
  const [loaded, setLoaded] = useState(() => repository.read());
  const [db, setDb] = useState(() => loaded.workspace || { data: blank(), demo: false });
  const [storageError, setStorageError] = useState('');
  const [retry, setRetry] = useState(0);
  const data = db.data || blank();

  useEffect(() => {
    if (loaded.error) return;
    try {
      repository.save(db);
      setStorageError('');
    } catch {
      setStorageError(
        'Your latest changes are only in memory. Export a full backup before closing this page.',
      );
      alert(
        'Browser storage is full. Export your records now; large datasets need a database-backed deployment.',
      );
    }
  }, [db, repository, loaded.error, retry]);

  useEffect(() => {
    if (!storageError) return;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [storageError]);

  const retryLoad = useCallback(() => {
    const result = repository.read();
    setLoaded(result);
    if (result.workspace) setDb(result.workspace);
  }, [repository]);

  const startEmpty = useCallback(() => {
    setDb({ data: blank(), demo: false });
    setLoaded({ workspace: null, error: null, raw: null });
  }, []);

  const retryStorage = useCallback(() => setRetry((value) => value + 1), []);

  return { db, setDb, data, storageError, retryStorage, recovery: loaded, retryLoad, startEmpty };
}

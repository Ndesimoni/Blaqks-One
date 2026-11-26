import { useContext } from 'react';
import { SessionContext } from '../app/SessionContext.js';

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw Error('useSession must be used within SessionProvider.');
  return session;
}

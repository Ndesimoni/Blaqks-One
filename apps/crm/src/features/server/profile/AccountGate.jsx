import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { ProfileSkeleton } from './ProfileSkeleton.jsx';
import { useAccount } from './useAccount.js';

/**
 * Loads the member's own account for a My profile tab: a skeleton while it loads, Retry when it
 * fails, then `children(state)` with `{ account, reload, replace }`.
 */
export function AccountGate({ children }) {
  const { api } = useSession();
  const state = useAccount(api);
  if (state.error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{state.error}</p>
        <Button onClick={state.reload}>Retry</Button>
      </section>
    );
  if (!state.account) return <ProfileSkeleton />;
  return children(state);
}

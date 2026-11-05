import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.js';
import { ServerStatus } from './ServerStatus.jsx';
import { ServerWorkspace } from './ServerWorkspace.jsx';
import { ServerSignOut } from './ServerSignOut.jsx';

export function ServerDirectory() {
  const { api, user } = useSession();
  const location = useLocation();
  const go = useNavigate();
  const [workspaces, setWorkspaces] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const refreshDirectory = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api
      .workspaces(controller.signal)
      .then((result) => {
        if (!Array.isArray(result.workspaces) || !result.workspaces.length)
          throw Error('No workspace is available for this account.');
        if (!controller.signal.aborted) setWorkspaces(result.workspaces);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, attempt]);
  if (location.pathname === '/sign-out') return <ServerSignOut />;
  // Every member lands on the start page (NAV1b, owner 2026-10-31).
  if (location.pathname === '/') return <Navigate to={`/start${location.search}`} replace />;
  if (error)
    return (
      <ServerStatus
        title="Unable to open your workspace"
        message={error}
        retry={() => setAttempt((value) => value + 1)}
        signIn={() => go('/sign-out')}
      />
    );
  if (!workspaces)
    return <ServerStatus title="Opening your workspace" message="Loading permitted workspaces…" />;
  // Everyone opens their own workspace only (BO1): no one switches into another company.
  const own = user.roleId === 'super-admin' ? 'super-admin-workspace' : user.workspaceId || user.id;
  const owner = workspaces.find((workspace) => workspace.id === own) || workspaces[0];
  return (
    <ServerWorkspace
      key={`${user.id}:${owner.id}`}
      owner={owner}
      refreshDirectory={refreshDirectory}
    />
  );
}

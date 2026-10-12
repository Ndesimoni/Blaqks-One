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
  if (location.pathname === '/') {
    const first = user.permissions?.relationships
      ? '/clients'
      : user.permissions?.properties
        ? '/properties'
        : '/workspace';
    return <Navigate to={`${first}${location.search}`} replace />;
  }
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
  const requested = new URLSearchParams(location.search).get('workspace');
  const owner =
    workspaces.find(
      (workspace) =>
        workspace.id ===
        (requested ||
          (user.roleId === 'super-admin' ? 'super-admin-workspace' : user.workspaceId || user.id)),
    ) || (!requested ? workspaces[0] : null);
  if (!owner)
    return (
      <ServerStatus
        title="Workspace access is restricted"
        message="This account cannot open the selected workspace."
        retry={() => go('/clients')}
      />
    );
  return (
    <ServerWorkspace
      key={`${user.id}:${owner.id}`}
      owner={owner}
      workspaces={workspaces}
      refreshDirectory={refreshDirectory}
    />
  );
}

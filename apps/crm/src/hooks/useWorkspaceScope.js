import { useContext } from 'react';
import { WorkspaceScopeContext } from '../app/WorkspaceScopeContext.js';
export function useWorkspaceScope() {
  const value = useContext(WorkspaceScopeContext);
  if (!value) throw Error('Workspace scope requires WorkspaceProvider.');
  return value;
}

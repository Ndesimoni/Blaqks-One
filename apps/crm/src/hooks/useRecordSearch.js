import { useRecords, useWorkspaceView } from './useWorkspace.js';
import { selectRecords } from '../lib/workspace.js';

export function useRecordSearch(module, filter) {
  const { data } = useRecords();
  const { query, sort } = useWorkspaceView();
  return selectRecords(data, module, { query, sort, filter });
}

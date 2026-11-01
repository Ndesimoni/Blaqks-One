import { useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { slug } from '../../../lib/records.js';

const statusKey = slug('Task status');

/**
 * The mockup's Done checkbox on a follow-up row: ticking saves Task status Completed, unticking
 * Open, through the connected save (permissions, version check, activity). Only people who may
 * edit follow-ups can tick; a refusal or a record needing fixes is shown as a toast.
 */
export function useDeadlineDone() {
  const { t } = useI18n();
  const { saveRecord, can, readOnly = false, busy = false } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const allowed = !readOnly && Boolean(can?.('Follow-ups', 'edit'));
  const toggle = async (record, done) => {
    const next = { ...record, [statusKey]: done ? 'Completed' : 'Open' };
    const result = await saveRecord('Follow-ups', next, record);
    if (result?.message) setToast(result.message);
    else if (result?.errors) setToast(t('followUps.fixFirst'));
  };
  return { allowed, busy, toggle };
}

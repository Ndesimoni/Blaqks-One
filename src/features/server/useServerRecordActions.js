import { schema } from '../../lib/schema.js';
import { actionDeniedMessages, canAct, deleteRefusal, saveRefusal } from './access.js';
import { useServerMutations } from './useServerMutations.js';

const archivedMessage = 'Archived workspaces are read-only.';

/** Connected record actions, gated by the session's `recordActions` (action permissions §6). */
export function useServerRecordActions(options) {
  const { records, view, user, readOnly = false } = options;
  const mutations = useServerMutations(options);
  const can = (module, action) => !readOnly && canAct(user, module, action);
  const refused = (module, action) => {
    if (can(module, action)) return false;
    if (!readOnly) view.setToast(actionDeniedMessages[action]);
    return true;
  };
  const edit = (module, record, initialSection) => {
    if (readOnly || mutations.busy || refused(module, 'edit')) return;
    view.setDetail(null);
    view.setDrawer({ module, record: { ...record }, original: record, initialSection });
  };
  return {
    ...mutations,
    readOnly,
    can,
    saveRecord: (module, record, original, ...rest) => {
      if (readOnly) return Promise.resolve({ message: archivedMessage });
      // The editor keeps the draft and shows this message, as it does for a server 403.
      const refusal = saveRefusal(user, module, original);
      if (refusal) return Promise.resolve({ message: refusal });
      return mutations.saveRecord(module, record, original, ...rest);
    },
    canDelete: (module, record) => !readOnly && !deleteRefusal(user, records, module, record),
    deleteRecord: (module, record, ...rest) => {
      if (readOnly) return;
      const refusal = deleteRefusal(user, records, module, record);
      if (refusal) return view.setToast(refusal);
      return mutations.deleteRecord(module, record, ...rest);
    },
    reloadRecord: (...args) => {
      if (!readOnly) return mutations.reloadRecord(...args);
    },
    edit,
    add(module, defaults = {}) {
      if (readOnly || mutations.busy || refused(module, 'create')) return;
      view.setDetail(null);
      view.setDrawer({
        module,
        // Connected IDs are issued by the server when the record is first saved.
        record: { [schema(module)[0].key]: '', ...defaults },
        original: null,
      });
    },
    dispatchRow(module, record) {
      if (!mutations.busy) view.setDetail({ module, record });
    },
    startMessage() {
      if (readOnly) return;
      view.setToast('Messaging accounts are not connected yet.');
    },
  };
}

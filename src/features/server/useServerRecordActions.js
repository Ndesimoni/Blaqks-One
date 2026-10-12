import { schema } from '../../lib/schema.js';
import { canDeleteRecord } from './access.js';
import { useServerMutations } from './useServerMutations.js';

export function useServerRecordActions(options) {
  const { records, view, readOnly = false } = options;
  const mutations = useServerMutations(options);
  const edit = (module, record, initialSection) => {
    if (readOnly || mutations.busy) return;
    view.setDetail(null);
    view.setDrawer({ module, record: { ...record }, original: record, initialSection });
  };
  return {
    ...mutations,
    readOnly,
    saveRecord: (...args) =>
      readOnly
        ? Promise.resolve({ message: 'Archived workspaces are read-only.' })
        : mutations.saveRecord(...args),
    canDelete: (module) => !readOnly && canDeleteRecord(records.scope, module),
    deleteRecord: (module, ...args) => {
      if (!readOnly && canDeleteRecord(records.scope, module))
        return mutations.deleteRecord(module, ...args);
    },
    reloadRecord: (...args) => {
      if (!readOnly) return mutations.reloadRecord(...args);
    },
    edit,
    add(module, defaults = {}) {
      if (readOnly || mutations.busy) return;
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

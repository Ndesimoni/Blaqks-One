import { newId, schema } from '../../lib/schema.js';
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
    deleteRecord: (...args) => {
      if (!readOnly) return mutations.deleteRecord(...args);
    },
    reloadRecord: (...args) => {
      if (!readOnly) return mutations.reloadRecord(...args);
    },
    edit,
    add(module) {
      if (readOnly || mutations.busy) return;
      view.setDetail(null);
      view.setDrawer({
        module,
        record: { [schema(module)[0].key]: newId(module, records.data[module]) },
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

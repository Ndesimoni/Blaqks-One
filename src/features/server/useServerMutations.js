import { useEffect, useRef, useState } from 'react';
import { schema } from '../../lib/schema.js';
import { normalizeRecord, validateRecord } from '../records/validation.js';
import { installServerRecord, readServerRecords, serverRecordMetadata } from './records.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { serverMutationFailure } from './errors.js';

export function useServerMutations({ api, workspaceId, records, view }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useUnsavedChanges(false, busy);
  const saveRecord = async (module, record, original) => {
    if (pending.current) return { message: 'A save is already in progress.' };
    const normalized = normalizeRecord(module, record);
    const errors = validateRecord(module, normalized, records.data[module], original, records.data);
    if (Object.keys(errors).length) return { errors };
    const metadata = original ? serverRecordMetadata(records.entries, module, original) : undefined;
    pending.current = true;
    setBusy(true);
    try {
      const saved = await api.save(workspaceId, module, normalized, metadata);
      if (!alive.current) return {};
      readServerRecords({ records: { ...records.entries, [module]: [saved] } });
      records.setEntries((entries) => installServerRecord(entries, module, saved));
      view.setDrawer(null);
      view.setToast(original ? 'Record saved' : 'Record created');
      return { workspace: true };
    } catch (error) {
      return serverMutationFailure(error, original);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const deleteRecord = async (module, record) => {
    if (
      pending.current ||
      !confirm(`Delete ${record[schema(module)[0].key]} permanently from this workspace?`)
    )
      return;
    const metadata = serverRecordMetadata(records.entries, module, record);
    pending.current = true;
    setBusy(true);
    try {
      await api.remove(workspaceId, module, metadata);
      if (!alive.current) return;
      records.setEntries((entries) => ({
        ...entries,
        [module]: entries[module].filter((row) => row.id !== metadata.id),
      }));
      view.setDetail(null);
      view.setToast('Record deleted');
    } catch (error) {
      if (alive.current) view.setToast(error.message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const reloadRecord = async (module, original) => {
    const metadata = serverRecordMetadata(records.entries, module, original);
    const entries = readServerRecords(await api.records(workspaceId));
    if (!alive.current) return;
    const latest = entries[module].find((entry) => entry.id === metadata.id);
    if (!latest) throw Error('This record has been deleted. Your draft has been retained.');
    records.setEntries(entries);
    view.setDrawer({
      module,
      record: latest.record,
      original: latest.record,
      revision: latest.version,
    });
  };
  return { busy, saveRecord, deleteRecord, reloadRecord };
}

import { useEffect, useRef, useState } from 'react';
import { schema } from '../../lib/schema.js';
import { normalizeRecord, validateRecord } from '../records/validation.js';
import {
  installServerRecord,
  readServerEntry,
  readServerRecords,
  recordUnavailableMessage,
  removeServerRecord,
  serverRecordMetadata,
} from './records.js';
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
  /** L5: a 404 on an existing record means it is hidden or gone, so drop it locally. */
  const unavailable = (error, module, metadata) => {
    if (error.status !== 404 || !metadata || !alive.current) return false;
    records.setEntries((entries) => removeServerRecord(entries, module, metadata.id));
    return true;
  };
  const saveRecord = async (module, record, original) => {
    if (pending.current) return { message: 'A save is already in progress.' };
    const normalized = normalizeRecord(module, record);
    // Connected creates may leave the ID blank; the server issues it (contract §5, L1).
    const idRule = { idOptional: !original };
    const errors = validateRecord(
      module,
      normalized,
      records.data[module],
      original,
      records.data,
      idRule,
    );
    if (Object.keys(errors).length) return { errors };
    const metadata = original ? serverRecordMetadata(records.entries, module, original) : undefined;
    pending.current = true;
    setBusy(true);
    try {
      const saved = await api.save(workspaceId, module, normalized, metadata);
      if (!alive.current) return {};
      readServerEntry(module, saved);
      records.setEntries((entries) => installServerRecord(entries, module, saved));
      view.setDrawer(null);
      view.setToast(original ? 'Record saved' : 'Record created');
      return { workspace: true };
    } catch (error) {
      if (!unavailable(error, module, metadata)) return serverMutationFailure(error, original);
      return { message: recordUnavailableMessage };
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
      if (!alive.current) return;
      if (unavailable(error, module, metadata)) view.setDetail(null);
      view.setToast(error.status === 404 ? recordUnavailableMessage : error.message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const reloadRecord = async (module, original) => {
    const metadata = serverRecordMetadata(records.entries, module, original);
    const parsed = readServerRecords(await api.records(workspaceId));
    if (!alive.current) return;
    records.install(parsed);
    const latest = parsed.entries[module].find((entry) => entry.id === metadata.id);
    if (!latest) throw Error(`${recordUnavailableMessage} Your draft has been retained.`);
    view.setDrawer({
      module,
      record: latest.record,
      original: latest.record,
      revision: latest.version,
    });
  };
  return { busy, saveRecord, deleteRecord, reloadRecord };
}

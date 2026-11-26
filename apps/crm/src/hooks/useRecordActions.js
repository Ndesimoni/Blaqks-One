import { useMemo, useRef, useState } from 'react';
import { MAX_MEDIA_TOTAL } from '../config/storage.js';
import { SEED_CRM } from '../data/demo.js';
import { blank, newId, schema } from '../lib/schema.js';
import { today } from '../lib/dates.js';
import { normalizeWorkspaceData } from '../lib/validation.js';
import { removeWorkspaceRecord, saveWorkspaceRecord } from '../features/records/commands.js';
import { createFullBackup, parseFullBackup } from '../services/files/backup.js';
import { downloadJson } from '../services/files/download.js';
import { calendarDefaults } from '../config/calendar.js';
import { useSession } from './useSession.js';
import { canVisit } from '../features/team/model.js';
import { hasMessagingAccess } from '../features/messaging/model.js';
import { appendActivity } from '../features/activity/model.js';

export function useRecordActions(
  { db, data, setDb },
  { setDrawer, setDetail, setToast, setMessageDraft },
  navigate,
  calendarConnected = false,
  workspaceId,
) {
  const { user } = useSession();
  const uploadRef = useRef(null);
  const restoreRef = useRef(null);
  const busyRef = useRef(false);
  const [fileBusy, setFileBusy] = useState(false);

  return useMemo(() => {
    const notify = (message) => setToast(message);
    const audit = (current, event) => appendActivity(current, user, workspaceId, event);
    const recordActivity = (event) => setDb((current) => audit(current, event));
    const startMessage = (client = null, channel) => {
      if (!hasMessagingAccess(user) || (channel && !user.channelAccess[channel])) {
        notify('Your Super Admin has not allowed this messaging channel.');
        return;
      }
      if (client && !canVisit(user, 'Clients')) {
        notify('Your assigned role does not allow access to client profiles.');
        return;
      }
      setDetail(null);
      setMessageDraft({ client, channel });
    };
    const permitted = (module) => {
      const allowed = module ? canVisit(user, module) : user.permissions.exports;
      if (!allowed) notify('Your assigned role does not allow this action.');
      return allowed;
    };
    const saveRecord = (module, record, original) => {
      if (!permitted(module))
        return {
          errors: {},
          message: 'Your assigned role does not allow changes to this section.',
        };
      const result = saveWorkspaceRecord(db, module, record, original);
      if (!result.workspace) return result;
      const idField = schema(module)[0].key;
      const fields = original
        ? schema(module)
            .filter(
              (field) =>
                !field.calculated &&
                JSON.stringify(original[field.key]) !== JSON.stringify(record[field.key]),
            )
            .map((field) => field.name)
        : [];
      if (original && JSON.stringify(original.media_photos) !== JSON.stringify(record.media_photos))
        fields.push('Photos');
      if (
        original &&
        JSON.stringify(original.media_floorplans) !== JSON.stringify(record.media_floorplans)
      )
        fields.push('Floor plans');
      setDb(
        audit(result.workspace, {
          action: original ? 'update' : 'create',
          module,
          recordId: record[idField],
          label: record.full_name || record.listing_title || record.next_action || record[idField],
          fields,
        }),
      );
      setDrawer(null);
      notify(original ? 'Record updated successfully' : 'Record added successfully');
      return result;
    };
    const deleteRecord = (module, record) => {
      if (!permitted(module)) return;
      const id = schema(module)[0].key;
      if (!confirm(`Delete ${record[id]} permanently from this browser?`)) return;
      setDb((current) =>
        audit(removeWorkspaceRecord(current, module, record), {
          action: 'delete',
          module,
          recordId: record[id],
          label: record.full_name || record.listing_title || record.next_action || record[id],
        }),
      );
      setDrawer(null);
      setDetail(null);
      notify('Record removed');
    };
    const clearDemo = () => {
      if (!permitted()) return;
      if (
        !confirm(
          'Start with an empty workspace? This replaces the demo records. Export first if you need your current data.',
        )
      )
        return;
      setDb((current) =>
        audit(
          { ...current, data: blank(), demo: false },
          { action: 'clear', label: 'Started with an empty CRM' },
        ),
      );
      notify('Your blank CRM workspace is ready');
      navigate('Dashboard');
    };
    const restoreDemo = () => {
      if (!permitted()) return;
      if (
        !confirm(
          'Replace ALL local records with example data? Export your data first if you need it.',
        )
      )
        return;
      setDb((current) =>
        audit(
          { ...current, data: SEED_CRM(), demo: true },
          { action: 'sample', label: 'Loaded fictional example records' },
        ),
      );
      notify('Example workspace restored');
    };
    const downloadFullBackup = () => {
      if (!permitted()) return;
      downloadJson(createFullBackup(data), `Keys_with_Simoni_Full_Backup_${today()}.json`);
      notify('Full backup exported with property media.');
    };
    const readFile = async (event, importFile) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!permitted()) {
        input.value = '';
        return;
      }
      if (!file || busyRef.current) return;
      busyRef.current = true;
      setFileBusy(true);
      try {
        if (file.size > 15 * 1024 * 1024) throw Error('Please use a file smaller than 15 MB.');
        const restored = importFile
          ? normalizeWorkspaceData(await (await import('../lib/excel.js')).importExcel(file))
          : parseFullBackup(await file.text());
        if (JSON.stringify({ data: restored, demo: false }).length > MAX_MEDIA_TOTAL)
          throw Error('Records exceed this browser edition’s storage limit.');
        const count = Object.values(restored)
          .filter(Array.isArray)
          .reduce((sum, rows) => sum + rows.length, 0);
        const prompt = importFile
          ? `Import ${count} records from ${file.name}? This will REPLACE your existing local records. Export a backup first if needed.`
          : 'Restore this full backup? It replaces current CRM records and attached media.';
        if (!confirm(prompt)) return;
        setDb((current) =>
          audit(
            { ...current, data: restored, demo: false },
            {
              action: importFile ? 'import' : 'restore',
              label: `${count} records`,
            },
          ),
        );
        notify(
          importFile
            ? `Imported ${count} records from Excel.`
            : 'Full backup restored with property photos and floor plans.',
        );
        navigate(importFile ? 'Dashboard' : 'Properties');
      } catch (error) {
        alert(error.message || 'The selected file could not be opened.');
      } finally {
        input.value = '';
        busyRef.current = false;
        setFileBusy(false);
      }
    };
    const downloadRaw = () => {
      if (!permitted()) return;
      const link = document.createElement('a');
      link.href = `${import.meta.env.BASE_URL}data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx`;
      link.download = 'Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx';
      link.click();
    };
    const add = (module, pre = {}) => {
      if (!permitted(module)) return;
      setDetail(null);
      setDrawer({
        module,
        record: {
          [schema(module)[0].key]: newId(module, data[module]),
          ...calendarDefaults(module),
          ...(Object.keys(calendarDefaults(module)).length
            ? { calendar_enabled: calendarConnected ? 'Yes' : 'No' }
            : {}),
          ...pre,
        },
        original: null,
      });
    };
    const edit = (module, record, initialSection) => {
      if (!permitted(module)) return;
      setDetail(null);
      setDrawer({ module, record: { ...record }, original: record, initialSection });
    };
    const dispatchRow = (module, record) => {
      if (permitted(module)) setDetail({ module, record });
    };
    const exportWorkbook = async () => {
      if (!permitted()) return;
      if (busyRef.current) return;
      busyRef.current = true;
      setFileBusy(true);
      try {
        const { exportExcel } = await import('../lib/excel.js');
        await exportExcel(data, notify);
      } catch {
        alert('Excel export could not be loaded. Please reload and try again.');
      } finally {
        busyRef.current = false;
        setFileBusy(false);
      }
    };
    return {
      uploadRef,
      restoreRef,
      fileBusy,
      notify,
      recordActivity,
      startMessage,
      saveRecord,
      deleteRecord,
      clearDemo,
      restoreDemo,
      downloadFullBackup,
      downloadRaw,
      add,
      edit,
      dispatchRow,
      exportWorkbook,
      restoreFullBackup: (event) => readFile(event, false),
      onUpload: (event) => readFile(event, true),
    };
  }, [
    db,
    data,
    setDb,
    setDrawer,
    setDetail,
    setToast,
    navigate,
    fileBusy,
    calendarConnected,
    user,
    setMessageDraft,
    workspaceId,
  ]);
}

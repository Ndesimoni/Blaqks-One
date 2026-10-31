import React, { useRef, useState } from 'react';
import { KanbanBoard } from '../../components/ui/kanban/KanbanBoard.jsx';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { get } from '../../lib/records.js';
import { schema } from '../../lib/schema.js';
import { changesStage, leadColumns } from './boardModel.js';
import { LeadCardBody } from './LeadCardBody.jsx';

const fields = schema('Clients');
const idKey = fields[0].key;
const stageKey = fields.find((field) => field.name === 'Lead stage').key;

/**
 * The connected Leads pipeline (NAV): the filtered leads in one column per stage. A move
 * saves through the same path as the editor, so permissions, view-only shared leads,
 * validation and version conflicts behave exactly as they do there.
 */
export function LeadsBoard({
  records,
  allRecords = records,
  emptyTitle,
  emptyDetail,
  emptyAction,
}) {
  const { t } = useI18n();
  const { data } = useRecords();
  const actions = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const [saving, setSaving] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const focusSequence = useRef(0);
  const pending = useRef(false);
  const nameOf = (record) => String(get(record, 'Full name') || record[idKey] || '');
  const canMove = (record) =>
    !actions.readOnly &&
    !actions.busy &&
    !saving &&
    (actions.can ? actions.can('Clients', 'edit') : true) &&
    !actions.isKept?.('Clients', record);
  const move = async (record, stage) => {
    const name = nameOf(record);
    const key = String(record[idKey]);
    if (pending.current || actions.busy || !changesStage(record, stage)) return;
    pending.current = true;
    setSaving(key);
    try {
      const result = await actions.saveRecord('Clients', { ...record, [stageKey]: stage }, record);
      if (result?.errors) setToast(t('leadsBoard.incomplete', { name }));
      else if (result?.message) setToast(result.message);
      else setToast(t('leadsBoard.moved', { name, stage }));
    } catch (error) {
      setToast(error?.message || t('leadsBoard.failed', { name }));
    } finally {
      pending.current = false;
      setSaving('');
      setFocusRequest({ key, sequence: ++focusSequence.current });
    }
  };
  return (
    <KanbanBoard
      label={t('leadsBoard.label')}
      columns={leadColumns(records, allRecords)}
      itemKey={(record) => String(record[idKey])}
      canMove={canMove}
      moveLabel={(record) => t('leadsBoard.move', { name: nameOf(record) })}
      onMove={move}
      busy={Boolean(saving || actions.busy)}
      focusRequest={focusRequest}
      emptyTitle={emptyTitle}
      emptyDetail={emptyDetail}
      emptyAction={emptyAction}
      renderCard={(record) => (
        <LeadCardBody
          record={record}
          data={data}
          name={nameOf(record)}
          onOpen={() => actions.dispatchRow('Clients', record)}
        />
      )}
    />
  );
}

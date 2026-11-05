import React, { useContext } from 'react';
import { NavigationContext } from '../../app/WorkspaceContext.js';
import { Empty } from '../../components/ui/Empty.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { today } from '../../lib/dates.js';
import { useRecordAccess } from './useRecordAccess.js';

export const awaitingAssignmentText = 'Records assigned to you will appear here.';

function emptyText({ awaiting, detail, query, readOnly, canCreate }) {
  if (awaiting) return awaitingAssignmentText;
  if (detail) return detail;
  if (query) return 'Try another search or clear filters.';
  if (readOnly) return 'No records were saved in this archived workspace.';
  return canCreate
    ? 'Use Add record to start building your workspace.'
    : 'No records have been added yet.';
}

/**
 * Empty table state; Add appears only when the member may create records in the module. A list
 * with nothing in it yet reads as the approved mockup: "No clients yet" and Add a client.
 */
export function RecordTableEmpty({ module, title, detail, action, query, readOnly }) {
  const { t } = useI18n();
  const { add } = useWorkspaceActions();
  // Leads is a view over Clients; outside the app frame there is no page to read.
  const route = useContext(NavigationContext)?.route;
  const { data, scope } = useRecords();
  const canCreate = useRecordAccess()(module, 'create');
  const none = !data[module]?.length;
  // Assigned-only staff see records once they are assigned (connected projection scope).
  const awaiting = scope === 'assigned' && !query && none;
  const key = route === 'Leads' ? 'Leads' : module;
  const first = none && !awaiting && !readOnly && Boolean(t(`recordGrid.none.${key}`));
  const addFirst = () =>
    add(module, key === 'Leads' ? { lead_stage: 'New', date_added: today() } : {});
  const button = first ? (
    <Button icon="plus" onClick={addFirst}>
      {t(`recordGrid.add.${key}`)}
    </Button>
  ) : (
    (action ?? (
      <Button icon="plus" onClick={() => add(module)}>
        Add record
      </Button>
    ))
  );
  return (
    <Empty
      title={first ? t(`recordGrid.none.${key}`) : title}
      detail={
        first
          ? t('recordGrid.noneDetail', { add: t(`recordGrid.add.${key}`) })
          : emptyText({ awaiting, detail, query, readOnly, canCreate })
      }
      action={canCreate ? button : undefined}
    />
  );
}

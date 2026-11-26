import React, { useContext } from 'react';
import { RecordsContext } from '../../../app/WorkspaceContext.js';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasMessagingAccess } from '../../messaging/model.js';
import './grid-selection.css';

/**
 * The bar ticked rows bring up (the mockup's bulk bar): how many are selected and what the person
 * may do with them. Message replaces the old per-row button on Clients; `actions` is the page's
 * slot (connected mode adds Assign to…). Nothing shows until a row is ticked.
 */
export function GridSelectionBar({ module, selection, actions = null }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { startMessage, readOnly = false } = useWorkspaceActions();
  const keptFor = useContext(RecordsContext)?.keptFor;
  const { selected, clear } = selection;
  // A handed-over client the caller only keeps is not theirs to message (agreements §18).
  const messageable =
    module === 'Clients' && !readOnly && !selected.some((record) => keptFor?.('Clients', record));
  return (
    <>
      <p className="sr-only" role="status">
        {selected.length ? t('recordGrid.selected', { count: selected.length }) : ''}
      </p>
      {selected.length > 0 && (
        <div className="grid-selection" role="group" aria-label={t('recordGrid.selection')}>
          <strong aria-hidden="true">{t('recordGrid.selected', { count: selected.length })}</strong>
          {messageable && (
            <Button
              variant="light"
              icon="chat"
              disabled={!hasMessagingAccess(user)}
              onClick={() => startMessage(selected.length === 1 ? selected[0] : null)}
            >
              {t('recordGrid.message')}
            </Button>
          )}
          {actions?.(selected, clear)}
          <Button variant="light" className="grid-selection-clear" onClick={clear}>
            {t('recordGrid.clearSelection')}
          </Button>
        </div>
      )}
    </>
  );
}

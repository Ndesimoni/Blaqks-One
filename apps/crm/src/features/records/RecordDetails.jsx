import React, { useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { get } from '../../lib/records.js';
import { schema } from '../../lib/schema.js';
import { recordTitle } from './panel/panelModel.js';
import { RecordPanelActions } from './panel/RecordPanelActions.jsx';
import { RecordPanelBody } from './panel/RecordPanelBody.jsx';
import { RecordPanelHeader } from './panel/RecordPanelHeader.jsx';
import './panel/record-panel.css';

/**
 * Record details as a large panel from the right edge (Bitrix24's record slider, approved
 * mockup, owner 2026-10-31): title, actions and a client's stage track on top, then facts
 * beside the activity timeline or related records. The demo and connected mode share it;
 * connected-only sections arrive through `extras`.
 */
function RecordDetails({
  detail,
  data,
  edit,
  remove,
  close,
  busy = false,
  showMessaging = true,
  readOnly = false,
  canDelete = true,
  canEdit = true,
  extras = null,
}) {
  const { module, record } = detail;
  const { route } = useNavigation();
  const lead = module === 'Clients' && route === 'Leads';
  const id = get(record, schema(module)[0].name);
  const titleId = useId();
  return (
    // Opening a related record remounts the dialog so focus, scroll and the opener reset cleanly.
    <Drawer
      key={`${module}:${id}`}
      className="detail-drawer record-panel"
      placement="right"
      titleId={titleId}
      onClose={close}
    >
      <RecordPanelHeader
        module={module}
        record={record}
        id={id}
        title={recordTitle(record, id)}
        titleId={titleId}
        lead={lead}
        busy={busy}
        onClose={close}
        actions={
          <RecordPanelActions
            module={module}
            record={record}
            lead={lead}
            busy={busy}
            readOnly={readOnly}
            canDelete={canDelete}
            canEdit={canEdit}
            showMessaging={showMessaging}
            edit={edit}
            remove={remove}
            close={close}
          />
        }
      />
      <RecordPanelBody
        module={module}
        record={record}
        data={data}
        edit={edit}
        close={close}
        readOnly={readOnly || !canEdit}
        extras={extras}
      />
    </Drawer>
  );
}

export { RecordDetails };

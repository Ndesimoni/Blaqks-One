import { PropertyRecordDetails } from './PropertyRecordDetails.jsx';
import { RecordDetailFields } from './RecordDetailFields.jsx';
import { schema } from '../../lib/schema.js';
import { get } from '../../lib/records.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { Button } from '../../components/ui/Button.jsx';
import React, { useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { useNavigation, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useSession } from '../../hooks/useSession.js';
import { hasMessagingAccess } from '../messaging/model.js';
import { RecordSchedule } from '../calendar/RecordSchedule.jsx';

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
  const { module, record: r } = detail;
  const { route } = useNavigation();
  const { startMessage } = useWorkspaceActions();
  const { user } = useSession();
  const lead = module === 'Clients' && route === 'Leads';
  const fields = schema(module);
  const id = get(r, fields[0].name);
  const titleId = useId();
  const changeable = !readOnly && (canDelete || canEdit);
  return (
    <Drawer
      className="detail-drawer"
      size={module === 'Properties' ? 'wide' : 'standard'}
      titleId={titleId}
      onClose={close}
    >
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{(lead ? 'Leads' : module).toUpperCase()} · RECORD DETAILS</div>
          <h2
            id={titleId}
            tabIndex={module === 'Properties' ? -1 : undefined}
            data-initial-focus={module === 'Properties' ? true : undefined}
          >
            {get(r, 'Full name') || get(r, 'Listing title') || get(r, 'Next action') || id}
          </h2>
          <p>
            {id} · {fields.length} available fields
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close record details"
          onClick={close}
          disabled={busy}
        >
          <Icon name="close" size={21} />
        </button>
      </div>
      <div className="drawer-body">
        {extras}
        {module === 'Clients' && showMessaging && !readOnly && (
          <div className="record-message-action">
            <Button
              variant="light"
              icon="chat"
              disabled={!hasMessagingAccess(user)}
              onClick={() => startMessage(r)}
            >
              Start message
            </Button>
            <small>Choose Email or WhatsApp. No message is sent by this preview.</small>
          </div>
        )}
        {['Follow-ups', 'Viewings'].includes(module) && (
          <RecordSchedule module={module} record={r} data={data} />
        )}
        {module === 'Properties' && (
          <PropertyRecordDetails
            record={r}
            edit={edit}
            close={close}
            readOnly={readOnly || !canEdit}
          />
        )}
        <RecordDetailFields module={module} record={r} fields={fields} id={id} data={data} />
      </div>
      <div className="drawer-footer">
        {!changeable ? (
          <Button variant="light" onClick={close}>
            Close
          </Button>
        ) : (
          <>
            {canDelete && (
              <Button
                variant="danger-light"
                icon="trash"
                onClick={() => remove(module, r)}
                disabled={busy}
              >
                Delete
              </Button>
            )}
            {canEdit && (
              <Button
                icon="edit"
                disabled={busy}
                onClick={() => {
                  close();
                  edit(module, r);
                }}
              >
                {lead ? 'Edit lead' : 'Edit record'}
              </Button>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

export { RecordDetails };

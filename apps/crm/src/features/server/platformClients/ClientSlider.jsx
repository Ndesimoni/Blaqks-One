import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ClientFacts } from './ClientFacts.jsx';
import { ClientForm } from './ClientForm.jsx';
import { ClientSliderHead, SliderClose } from './ClientSliderHead.jsx';
import { ClientTimeline } from './ClientTimeline.jsx';
import { clientName } from './clientsModel.js';
import { usePlatformClient } from './usePlatformClient.js';
import '../../records/panel/record-panel.css';
import '../../records/panel/record-panel-body.css';

/** The slider's body while the client loads, or its error with Try again. */
function SliderWaiting({ one, titleId, onClose }) {
  const { t } = useI18n();
  const k = (key) => t(`platformClients.${key}`);
  return (
    <>
      <header className="drawer-top record-panel-head">
        <SliderClose onClose={onClose} />
        <h2 id={titleId} className="sr-only">
          {one.error ? k('detailFailed') : k('loading')}
        </h2>
      </header>
      <div className="drawer-body record-panel-body">
        {one.error ? (
          <StateView
            tone="error"
            role="alert"
            icon="close"
            title={k('detailFailed')}
            detail={one.error}
          >
            <Button onClick={one.reload}>{k('retry')}</Button>
          </StateView>
        ) : (
          <StateSkeleton label={k('loading')} rows={4} />
        )}
      </div>
    </>
  );
}

/**
 * One Blaqks One client in the CRM's right-edge record slider (approved mockup): the header
 * with the name, "Company · Source", Call, WhatsApp, Email and Text, the change actions and
 * the stage track; then the facts and notes beside the activity timeline. People with View
 * see everything without the change controls. Edit opens the form slider over it.
 */
export function ClientSlider({ id, manage, owners, onChanged, onToast, onClose }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const titleId = useId();
  const one = usePlatformClient(id, onChanged);
  const [editing, setEditing] = useState(false);
  const client = one.detail?.client;
  return (
    <Drawer
      className="detail-drawer record-panel platform-client-panel"
      placement="right"
      titleId={titleId}
      onClose={() => !one.busy && onClose()}
    >
      {!client ? (
        <SliderWaiting one={one} titleId={titleId} onClose={onClose} />
      ) : (
        <>
          <ClientSliderHead
            client={client}
            titleId={titleId}
            manage={manage}
            owners={owners}
            one={one}
            onEdit={() => setEditing(true)}
            onToast={onToast}
            onClose={onClose}
          />
          <div className="drawer-body record-panel-body">
            {one.problem && (
              <div className="platform-client-problem" role="alert">
                <p className="field-error">
                  {one.problem.conflict ? k('conflict') : one.problem.message}
                </p>
                {one.problem.conflict && (
                  <Button variant="light" onClick={one.reload}>
                    {k('reload')}
                  </Button>
                )}
              </div>
            )}
            <div className="record-panel-columns">
              <div className="record-panel-main">
                <ClientFacts client={client} />
              </div>
              <div className="record-panel-side">
                <ClientTimeline
                  client={client}
                  timeline={one.detail.timeline}
                  manage={manage}
                  one={one}
                />
              </div>
            </div>
          </div>
        </>
      )}
      {editing && client && (
        <ClientForm
          client={client}
          owners={owners}
          update={(fields) => one.update(fields, 'update', true)}
          onReload={one.reload}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onToast(k('saved', { name: clientName(saved) }));
          }}
        />
      )}
    </Drawer>
  );
}

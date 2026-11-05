import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { initials } from '../../../lib/records.js';
import { StageTrack } from '../../records/panel/StageTrack.jsx';
import { ClientActions } from './ClientActions.jsx';
import { ClientContactLinks } from './ClientContactLinks.jsx';
import { PIPELINE } from './clientsModel.js';
import '../../records/panel/record-panel-head.css';

/** The slider's close button, beside the panel's edge on wide screens. */
export function SliderClose({ onClose, busy = false }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="icon-btn record-panel-close"
      aria-label={t('platformClients.close')}
      onClick={onClose}
      disabled={busy}
      data-initial-focus
    >
      <Icon name="close" size={20} />
    </button>
  );
}

/**
 * The client slider's header, as the CRM record slider's: initials, the contact's name with
 * "Company · Source" below, Call, WhatsApp, Email and Text, then the change actions (Manage)
 * or Close (View), and the stage track from New to Customer (Lost shows apart). The name
 * takes focus once the client has loaded, so the panel starts from the top.
 */
export function ClientSliderHead({
  client,
  titleId,
  manage,
  owners,
  one,
  onEdit,
  onToast,
  onClose,
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const heading = useRef(null);
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) heading.current?.focus();
  }, []);
  const name = client.contactName || client.companyName;
  const subtitle = [
    client.contactName ? client.companyName : '',
    k(`source.${client.source}`),
  ].filter(Boolean);
  const stage = (key) => k(`stage.${key}`);
  return (
    <header className="drawer-top record-panel-head">
      <SliderClose onClose={onClose} busy={Boolean(one.busy)} />
      <div className="record-panel-identity">
        <span className="record-panel-avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="record-panel-title">
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {name}
          </h2>
          <p>{subtitle.join(' · ')}</p>
        </div>
      </div>
      <div className="record-panel-actions">
        <ClientContactLinks client={client} />
        {manage ? (
          <ClientActions
            client={client}
            owners={owners}
            one={one}
            onEdit={onEdit}
            onToast={onToast}
            onClose={onClose}
          />
        ) : (
          <div className="drawer-footer" role="group" aria-label={k('actions')}>
            <Button variant="light" onClick={onClose}>
              {k('close')}
            </Button>
          </div>
        )}
      </div>
      {!manage && (
        <div className="record-panel-status">
          <span className="demo-pill view-only-chip">
            <span /> {k('viewOnly')}
          </span>
        </div>
      )}
      <StageTrack
        value={stage(client.stage)}
        stages={PIPELINE.map(stage)}
        labelKey="platformClients.stageTrack"
      />
    </header>
  );
}

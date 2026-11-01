import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { get, initials } from '../../../lib/records.js';
import { KeptChip } from '../KeptChip.jsx';
import { hasAvatar, kindKey, recordStatus, subtitleParts } from './panelModel.js';
import { StageTrack } from './StageTrack.jsx';
import './record-panel-head.css';

/**
 * The panel header (approved mockup): close, an initials avatar for people, the title and a
 * one-line subtitle, the record's actions, its status and view-only chip, and a client's
 * Lead stage track. The title takes focus on opening so the panel starts from the top.
 */
export function RecordPanelHeader({
  module,
  record,
  id,
  title,
  titleId,
  lead,
  busy,
  onClose,
  actions,
}) {
  const { t } = useI18n();
  const kind = kindKey(module, lead);
  const subtitle = [
    kind ? t(`recordPanel.${kind}`) : module === 'Properties' ? '' : module,
    ...subtitleParts(module, record, id),
  ].filter(Boolean);
  const status = recordStatus(module, record);
  return (
    <header className="drawer-top record-panel-head">
      <button
        type="button"
        className="icon-btn record-panel-close"
        aria-label={t('recordPanel.close')}
        onClick={onClose}
        disabled={busy}
      >
        <Icon name="close" size={20} />
      </button>
      <div className="record-panel-identity">
        {hasAvatar(module) && (
          <span className="record-panel-avatar" aria-hidden="true">
            {initials(title)}
          </span>
        )}
        <div className="record-panel-title">
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {title}
          </h2>
          {subtitle.length > 0 && <p>{subtitle.join(' · ')}</p>}
        </div>
      </div>
      {actions}
      <div className="record-panel-status">
        {status ? <Badge>{status}</Badge> : null}
        <KeptChip module={module} record={record} />
      </div>
      {module === 'Clients' && <StageTrack value={get(record, 'Lead stage')} />}
    </header>
  );
}

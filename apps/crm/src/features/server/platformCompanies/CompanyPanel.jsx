import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasPlatformArea } from '../platformAccess.js';
import { SeatLimitDialog } from '../../server-team/SeatLimitDialog.jsx';
import { TeamArchiveDialog } from '../../server-team/TeamArchiveDialog.jsx';
import { CompanyMembers } from './CompanyMembers.jsx';
import { usePlatformMembers } from './usePlatformMembers.js';
import './company-panel.css';

/** A company Admin is archived through the organisation; an agent through their company. */
const archiveScope = (company, member) =>
  member.roleId === 'admin' ? 'super-admin-workspace' : company.id;

/**
 * A company opened from Blaqks One's Companies list (BO1a), as a right-edge panel: its Admin,
 * seats with Change seat limit, and its people with Suspend, Reactivate and Archive. Blaqks One
 * never enters the company or reads its records.
 */
export function CompanyPanel({ company, onClose, onChanged, onToast }) {
  const { t, format } = useI18n();
  const { user } = useSession();
  // Suspend, archive and seat limits need Manage on Companies (BO1b).
  const controls = hasPlatformArea(user, 'companies', 'manage');
  const k = (key, vars) => t(`platformCompanies.${key}`, vars);
  const titleId = useId();
  const list = usePlatformMembers(company.id);
  const [archiving, setArchiving] = useState(null);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const changed = () => {
    list.reload();
    onChanged();
  };
  const seats = {
    used: company.seatsUsed,
    limit: company.seatLimit ?? company.seatsUsed,
    version: company.version,
  };
  return (
    <Drawer placement="right" className="company-panel" titleId={titleId} onClose={onClose}>
      <header className="company-panel-head">
        <button type="button" className="icon-btn company-panel-close" onClick={onClose}>
          <Icon name="close" size={20} aria-hidden="true" />
          <span className="sr-only">{k('panelClose')}</span>
        </button>
        <h2 id={titleId} tabIndex={-1} data-initial-focus>
          {company.name}
        </h2>
        <p>
          {k('panelAdmin', { name: company.admin })} ·{' '}
          {k('panelCreated', { date: format.date(company.createdOn) })}
        </p>
      </header>
      <div className="company-panel-body">
        <section className="company-panel-card" aria-label={k('panelSeats')}>
          <div>
            <h3>{k('panelSeats')}</h3>
            <p>
              {company.seatLimit === null
                ? k('seatsOpen', { used: company.seatsUsed })
                : k('seats', { used: company.seatsUsed, limit: company.seatLimit })}
            </p>
          </div>
          {controls && company.status !== 'archived' && (
            <Button variant="light" onClick={() => setSeatsOpen(true)}>
              {k('changeSeats')}
            </Button>
          )}
        </section>
        <p className="company-panel-note">
          <Icon name="lock" size={16} aria-hidden="true" /> {k('panelPrivacy')}
        </p>
        <CompanyMembers
          list={list}
          controls={controls}
          onArchive={setArchiving}
          onToast={onToast}
        />
      </div>
      {seatsOpen && (
        <SeatLimitDialog
          workspaceId={company.id}
          seats={seats}
          onClose={() => setSeatsOpen(false)}
          onSaved={() => {
            setSeatsOpen(false);
            onChanged();
          }}
        />
      )}
      {archiving && (
        <TeamArchiveDialog
          workspaceId={archiveScope(company, archiving)}
          member={archiving}
          onClose={({ refresh } = {}) => {
            setArchiving(null);
            if (refresh) changed();
          }}
          onArchived={() => {
            setArchiving(null);
            changed();
          }}
        />
      )}
    </Drawer>
  );
}

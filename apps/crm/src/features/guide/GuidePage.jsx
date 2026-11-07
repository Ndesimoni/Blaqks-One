import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import React from 'react';
import { useNavigation, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useRecordAccess } from '../records/useRecordAccess.js';

function GuidePage() {
  const { navigate } = useNavigation();
  const { add, uploadRef, exportWorkbook } = useWorkspaceActions();
  const can = useRecordAccess();

  return (
    <div className="page-stack">
      <div className="guide-hero">
        <div className="eyebrow">GETTING STARTED</div>
        <h1>
          Build your business,
          <br />
          <em>one relationship at a time.</em>
        </h1>
        <p>
          A complete workflow for Keys with Simoni, from the first introduction to repeat referrals.
        </p>
        {can('Clients', 'create') && (
          <Button icon="plus" onClick={() => add('Clients')}>
            Add your first client
          </Button>
        )}
      </div>
      <div className="guide-grid">
        {[
          [
            '01',
            'Build your network',
            'Add owners, developers and partner brokers in Contacts.',
            'Contacts',
            'person',
          ],
          [
            '02',
            'Manage your listings',
            'Record property details, terms, documents, and permit status.',
            'Properties',
            'building',
          ],
          [
            '03',
            'Qualify every lead',
            'Track lead sources and campaigns, then capture requirements, budgets and urgency.',
            'Leads',
            'target',
          ],
          [
            '04',
            'Plan the next step',
            'Create follow-ups and log important client conversations.',
            'Follow-ups',
            'calendar',
          ],
          [
            '05',
            'Create perfect matches',
            'Match listings with a client and save shortlisted properties.',
            'Client desk',
            'target',
          ],
          [
            '06',
            'Arrange property viewings',
            'Log appointments, collect feedback, and identify objections.',
            'Viewings',
            'home',
          ],
          [
            '07',
            'Manage negotiations',
            'Progress each deal through documentation and closing.',
            'Deals',
            'briefcase',
          ],
          [
            '08',
            'Track the money',
            'Record commission receipts and expenses for accurate results.',
            'Payments',
            'wallet',
          ],
          [
            '09',
            'Nurture long-term clients',
            'Schedule renewal reminders, referrals and investor check-ins.',
            'Client care',
            'heart',
          ],
        ].map(([n, t, desc, dest, icon]) => (
          <button className="guide-card" key={n} onClick={() => navigate(dest)}>
            <div className="guide-top">
              <span>{n}</span>
              <Icon name={icon} size={22} />
            </div>
            <h3>{t}</h3>
            <p>{desc}</p>
            <div>
              Open {dest} <Icon name="arrow" size={15} />
            </div>
          </button>
        ))}
      </div>
      <div className="panel guide-import">
        <div>
          <h2>Bring your Excel workbook across.</h2>
          <p>
            Use Import Excel to load your existing rows from the 17-sheet workbook. Export Excel for
            your spreadsheet data, or use Full backup (JSON) to include property photos and floor
            plans. Everything stays in this browser until you export or clear browser storage.
          </p>
        </div>
        <div className="guide-actions">
          <Button icon="upload" variant="light" onClick={() => uploadRef.current?.click()}>
            Import Excel
          </Button>
          <Button icon="download" onClick={exportWorkbook}>
            Export Excel
          </Button>
        </div>
      </div>
    </div>
  );
}

export { GuidePage };

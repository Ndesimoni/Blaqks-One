import React, { useId } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { deriveLeadScore, leadTier } from '../../../lib/crm.js';
import { AED } from '../../../lib/format.js';
import { get, initials } from '../../../lib/records.js';
import { ContactCommand } from '../../records/panel/ContactCommand.jsx';
import { agentColumn } from '../assignment/agentColumn.js';
import { useAssignees } from '../assignment/useAssignees.js';
import { useContactCommands } from '../inbox/useContactCommands.jsx';
import { clientNeed } from './clientDeskModel.js';

/**
 * The chosen client (approved mockup): initials, name, what they look for and their budget;
 * stage, agent, source and lead quality as pills; then Call and Message as on the client's
 * slider, and Open client for the full record.
 */
export function DeskClientHero({ client }) {
  const { t } = useI18n();
  const { user } = useSession();
  const records = useRecords();
  const { dispatchRow } = useWorkspaceActions();
  const assignees = useAssignees('Clients', records.scope === 'team');
  const { commands, dialog } = useContactCommands({ module: 'Clients', record: client });
  const headingId = useId();
  const name = get(client, 'Full name') || get(client, 'Client ID');
  const budget = Number(get(client, 'Maximum budget AED')) || 0;
  const agent = agentColumn(records.entries, assignees.people, user, t('recordGrid.unassigned'));
  const pills = [
    agent.value(client) && t('clientDesk.agent', { name: agent.value(client) }),
    get(client, 'Lead source') && t('clientDesk.from', { source: get(client, 'Lead source') }),
    t('clientDesk.quality', { tier: leadTier(client), score: deriveLeadScore(client) }),
  ].filter(Boolean);
  return (
    <section className="client-desk-hero" aria-labelledby={headingId}>
      <div className="client-desk-person">
        <span className="client-desk-avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <div>
          <h2 id={headingId}>{name}</h2>
          <p>
            {[clientNeed(client), budget && t('clientDesk.upTo', { budget: AED(budget) })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      <div className="client-desk-pills">
        {get(client, 'Lead stage') && <Badge tone="amber">{get(client, 'Lead stage')}</Badge>}
        {pills.map((text) => (
          <span key={text} className="client-desk-pill">
            {text}
          </span>
        ))}
      </div>
      <div className="client-desk-actions">
        {[commands.call, commands.message].filter(Boolean).map((command) => (
          <ContactCommand key={command.label} command={command} />
        ))}
        <Button variant="light" icon="external" onClick={() => dispatchRow('Clients', client)}>
          {t('clientDesk.open')}
        </Button>
      </div>
      {dialog}
    </section>
  );
}

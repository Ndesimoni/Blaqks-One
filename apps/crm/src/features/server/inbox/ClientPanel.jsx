import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useNavigation, useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { get } from '../../../lib/records.js';
import { comingUp, recordFacts } from './clientPanelModel.js';
import { PanelHead } from './PanelHead.jsx';

/** What staff need beside the conversation: who this is, what's next, and the record. */
export function ClientPanel({ conversation, onClose }) {
  const { t } = useI18n();
  const { entries, data } = useRecords();
  const { navigate } = useNavigation();
  const actions = useWorkspaceActions();
  const row = conversation.conversation;
  const record = row.record;
  const entry = record?.recordId
    ? (entries?.[record.collection] || []).find((item) => item.id === record.recordId)
    : null;
  const facts = entry ? recordFacts(entry.record) : [];
  const upcoming = record?.legacyId ? comingUp(data, record.legacyId) : [];
  const [next, ...later] = upcoming;
  const client = record?.collection === 'Clients';
  // Open the record's own panel here when it is loaded, else its list (approved mockup).
  const open = () =>
    entry
      ? actions.dispatchRow(record.collection, entry.record)
      : navigate(client ? 'Leads' : 'Contacts');
  return (
    <aside
      className="inbox-panel"
      aria-label={t('inbox.panel.label')}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <PanelHead title={t('inbox.panel.title')} onClose={onClose} />
      {!record && (
        <section className="inbox-panel-section">
          <span className="inbox-eyebrow">{t('inbox.panel.newContact')}</span>
          <strong className="inbox-panel-name">{row.contact.name || row.contact.display}</strong>
          <bdi className="inbox-panel-sub">{row.contact.display}</bdi>
          <p className="inbox-panel-hint">
            {t(
              row.match === 'choice'
                ? 'inbox.panel.choiceHint'
                : row.suggestedLead
                  ? 'inbox.panel.suggestedHint'
                  : 'inbox.panel.unknownHint',
            )}
          </p>
        </section>
      )}
      {record?.unavailable && (
        <section className="inbox-panel-section">
          <span className="inbox-eyebrow">{t(`inbox.panel.linked${record.collection}`)}</span>
          <p className="inbox-panel-hint">{t('inbox.panel.unavailable')}</p>
        </section>
      )}
      {record && !record.unavailable && (
        <section className="inbox-panel-section">
          <span className="inbox-eyebrow">{t(`inbox.panel.linked${record.collection}`)}</span>
          <strong className="inbox-panel-name">{record.name || record.legacyId}</strong>
          {entry && get(entry.record, 'Lead stage') && (
            <Badge>{get(entry.record, 'Lead stage')}</Badge>
          )}
          {(facts.length > 0 || next) && (
            <dl className="inbox-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(`inbox.panel.fact.${label}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {next && (
                <div>
                  <dt>{t('inbox.panel.fact.nextStep')}</dt>
                  <dd>
                    {t(`inbox.panel.${next.kind}`, { title: next.title })} · {next.when}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {later.length > 0 && (
            <div className="inbox-coming">
              <span className="inbox-eyebrow">{t('inbox.panel.comingUp')}</span>
              <ul>
                {later.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span>{t(`inbox.panel.${item.kind}`, { title: item.title })}</span>
                    <small>{item.when}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="inbox-panel-actions">
            <Button variant="light" onClick={open}>
              {t(client ? 'inbox.panel.openClient' : 'inbox.panel.openContact')}
            </Button>
            {client && actions.can?.('Follow-ups', 'create') && (
              <Button
                variant="light"
                onClick={() => actions.add('Follow-ups', { client_id: record.legacyId })}
              >
                {t('inbox.panel.schedule')}
              </Button>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}

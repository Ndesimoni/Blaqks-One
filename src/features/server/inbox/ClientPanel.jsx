import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useNavigation, useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { get } from '../../../lib/records.js';
import { comingUp, recordFacts } from './clientPanelModel.js';
import { PanelHead } from './PanelHead.jsx';

/** What staff need beside the conversation: who this is, what's next, and the record. */
export function ClientPanel({ conversation, onClose }) {
  const { t } = useI18n();
  const { entries, data } = useRecords();
  const { navigate } = useNavigation();
  const row = conversation.conversation;
  const record = row.record;
  const entry = record?.recordId
    ? (entries?.[record.collection] || []).find((item) => item.id === record.recordId)
    : null;
  const facts = entry ? recordFacts(entry.record) : [];
  const upcoming = record?.legacyId ? comingUp(data, record.legacyId) : [];
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
          {facts.length > 0 && (
            <dl className="inbox-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(`inbox.panel.fact.${label}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {upcoming.length > 0 && (
            <div className="inbox-coming">
              <span className="inbox-eyebrow">{t('inbox.panel.comingUp')}</span>
              <ul>
                {upcoming.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span>{t(`inbox.panel.${item.kind}`, { title: item.title })}</span>
                    <small>{item.when}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="inbox-link"
            onClick={() => navigate(record.collection === 'Clients' ? 'Leads' : 'Contacts')}
          >
            {t(`inbox.panel.open${record.collection}`)}
          </button>
        </section>
      )}
    </aside>
  );
}

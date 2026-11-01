import React, { useContext } from 'react';
import { RecordsContext } from '../../app/WorkspaceContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { propertyPrice } from '../../lib/properties.js';
import { formatValue } from '../../lib/crm.js';
import { detailLink } from '../../lib/detailLinks.js';
import { LinkedContact } from './LinkedContact.jsx';
import { factSections } from './panel/factSections.js';

/**
 * Safe configured links open externally and a property's contact opens its details; every other
 * value, including unsafe URLs, is text. A connected log's deal shows only through `dealLinks`.
 */
function DetailValue({ module, record: r, field: f, data }) {
  const records = useContext(RecordsContext);
  if (module === 'Interaction log' && f.key === 'deal_id_optional' && records?.dealLinkFor) {
    if (!r[f.key]) return '—';
    const deal = records.dealLinkFor(r.log_id, r[f.key]);
    return deal || <span className="muted">Linked deal unavailable</span>;
  }
  if (module === 'Properties' && f.key === 'contact_id')
    return <LinkedContact id={r[f.key]} contacts={data?.Contacts} />;
  const link = detailLink(f, r[f.key]);
  if (link)
    return (
      <a className="detail-link" href={link.href} target="_blank" rel="noopener noreferrer">
        {link.label}
        <Icon name="external" size={14} />
      </a>
    );
  return module === 'Properties' && f.name === 'Price / annual rent AED'
    ? propertyPrice(r)
    : formatValue(data, module, r, f);
}

/**
 * Every workbook field of the record, in the editor's named sections (calculated fields
 * last). The record's ID and status appear in the panel header above.
 */
export function RecordDetailFields({ module, record: r, data }) {
  const { t } = useI18n();
  return (
    <div className="record-facts">
      {factSections(module, t('recordPanel.calculated')).map((section) => (
        <section className="record-facts-section" key={section.id}>
          <h3>{section.title}</h3>
          <div className="details-grid">
            {section.fields.map((f) => (
              <div className={'detail-field ' + (f.type === 'textarea' ? 'wide' : '')} key={f.key}>
                <span>{f.name}</span>
                <strong>
                  <DetailValue module={module} record={r} field={f} data={data} />
                </strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

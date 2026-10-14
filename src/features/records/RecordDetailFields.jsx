import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { get } from '../../lib/records.js';
import { propertyPrice } from '../../lib/properties.js';
import { formatValue } from '../../lib/crm.js';
import { detailLink } from '../../lib/detailLinks.js';

/** Safe configured links open externally; every other value, including unsafe URLs, is text. */
function DetailValue({ module, record: r, field: f, data }) {
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

export function RecordDetailFields({ module, record: r, fields, id, data }) {
  return (
    <>
      <div className="detail-highlight">
        <span className="detail-watermark">
          <Icon name="briefcase" size={30} />
        </span>
        <div>
          <small>RECORD ID</small>
          <strong>{id}</strong>
        </div>
        <Badge>
          {get(r, 'Lead stage') ||
            get(r, 'Deal stage') ||
            get(r, 'Listing status') ||
            get(r, 'Task status') ||
            'Active'}
        </Badge>
      </div>
      <div className="details-grid">
        {fields.map((f) => (
          <div className={'detail-field ' + (f.type === 'textarea' ? 'wide' : '')} key={f.key}>
            <span>{f.name}</span>
            <strong>
              <DetailValue module={module} record={r} field={f} data={data} />
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}

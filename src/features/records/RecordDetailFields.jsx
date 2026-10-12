import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { get } from '../../lib/records.js';
import { propertyPrice } from '../../lib/properties.js';
import { formatValue } from '../../lib/crm.js';

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
              {module === 'Properties' && f.name === 'Price / annual rent AED'
                ? propertyPrice(r)
                : formatValue(data, module, r, f)}
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}

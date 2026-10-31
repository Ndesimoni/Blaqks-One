import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { propertyListingTags } from '../../config/properties.js';
import { propertyMatchesPurpose } from '../../lib/properties.js';

export function PropertyPurposes({ all, purpose, updateFilter }) {
  const countByPurpose = (key) => all.filter((p) => propertyMatchesPurpose(p, key)).length;
  return (
    <OverflowList
      items={propertyListingTags}
      getKey={(item) => item.key}
      activeKey={purpose}
      label="Filter by listing purpose"
      listClassName="property-purpose-bar"
      renderItem={(item, _index, { close }) => (
        <button
          type="button"
          className={'purpose-pill ' + (purpose === item.key ? 'selected' : '')}
          aria-pressed={purpose === item.key}
          onClick={() => {
            updateFilter('purpose', item.key);
            close();
          }}
        >
          <Icon name={item.icon} size={17} />
          <span>{item.label}</span>
          <b>{countByPurpose(item.key)}</b>
        </button>
      )}
    />
  );
}

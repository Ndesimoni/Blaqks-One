import React from 'react';
import { get } from '../../lib/records.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { PropertyGallery } from '../properties/PropertyGallery.jsx';
import { mediaPlans } from '../../lib/media.js';
import { amenityList } from '../../lib/properties.js';
import { safeExternalUrl } from '../../lib/validation.js';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { BuildingContacts } from './BuildingContacts.jsx';

export function PropertyRecordDetails({ record: r, contacts, edit, close, readOnly = false }) {
  return (
    <div className="property-detail-studio">
      <PropertyGallery
        record={r}
        onEdit={
          readOnly
            ? undefined
            : () => {
                close();
                edit('Properties', r, 'presentation');
              }
        }
      />
      <div className="media-detail-block">
        <div className="detail-section-heading">
          <Icon name="layers" size={18} />
          <h3>Floor plans & virtual tours</h3>
        </div>
        <div className="floorplan-list">
          {mediaPlans(r).map((plan, i) => (
            <a
              key={i}
              href={plan.src}
              target="_blank"
              rel="noopener noreferrer"
              download={plan.name}
            >
              <Icon name={plan.type === 'application/pdf' ? 'note' : 'image'} size={17} />
              <span>{plan.name}</span>
              <Icon name="external" size={15} />
            </a>
          ))}
          {safeExternalUrl(get(r, 'Floor plan URL')) && (
            <a
              href={safeExternalUrl(get(r, 'Floor plan URL'))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open linked floor plan <Icon name="external" size={15} />
            </a>
          )}
          {safeExternalUrl(get(r, 'Virtual tour URL')) && (
            <a
              href={safeExternalUrl(get(r, 'Virtual tour URL'))}
              target="_blank"
              rel="noopener noreferrer"
            >
              View virtual tour <Icon name="external" size={15} />
            </a>
          )}
          {!mediaPlans(r).length && !get(r, 'Floor plan URL') && !get(r, 'Virtual tour URL') && (
            <p className="property-muted">No floor plans or tours added yet.</p>
          )}
        </div>
      </div>
      <div className="media-detail-block">
        <div className="detail-section-heading">
          <Icon name="check" size={18} />
          <h3>Amenities & highlights</h3>
        </div>
        {amenityList(r).length ? (
          <OverflowList
            items={amenityList(r)}
            getKey={(a) => a}
            label="Property amenities"
            listClassName="amenity-tags"
            renderItem={(a) => (
              <span>
                <Icon name="check" size={13} />
                {a}
              </span>
            )}
          />
        ) : (
          <p className="property-muted">Amenities have not been added.</p>
        )}
        {get(r, 'Key selling points') && (
          <p className="property-highlights">{get(r, 'Key selling points')}</p>
        )}
        {get(r, 'Property description') && (
          <p className="property-description">{get(r, 'Property description')}</p>
        )}
      </div>
      <BuildingContacts property={r} contacts={contacts} />
    </div>
  );
}

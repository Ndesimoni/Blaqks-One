import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { AMENITIES } from '../../config/properties.js';
import { amenityList } from '../../lib/properties.js';

export function PropertyAmenityPicker({ form, setForm }) {
  return (
    <div className="amenity-picker">
      <strong>Quick-add amenities</strong>
      <OverflowList
        mode="scroll"
        className="amenity-options-list"
        items={AMENITIES}
        getKey={(name) => name}
        label="Amenity options"
        listClassName="amenity-chip-list"
        renderItem={(name) => (
          <button
            type="button"
            className={amenityList(form).includes(name) ? 'checked' : ''}
            aria-pressed={amenityList(form).includes(name)}
            onClick={() =>
              setForm((p) => {
                const a = amenityList(p);
                return {
                  ...p,
                  amenities: (a.includes(name) ? a.filter((x) => x !== name) : [...a, name]).join(
                    ', ',
                  ),
                };
              })
            }
          >
            {amenityList(form).includes(name) && <Icon name="check" size={12} />} {name}
          </button>
        )}
      />
    </div>
  );
}

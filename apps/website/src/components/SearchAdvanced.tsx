import type { Catalogue, Query } from '../lib/types';
import {
  amenities,
  bathroomOptions,
  bedroomOptions,
  furnishings,
  markets,
  readiness,
} from '../lib/options';
import { NumberField, SelectField } from './SearchControls';
import { first } from './ui';

export function SearchAdvanced({
  query,
  catalogue,
  purpose,
  commercial,
}: {
  query: Query;
  catalogue: Catalogue;
  purpose: string;
  commercial: boolean;
}) {
  const selected = [query.amenities]
    .flat()
    .filter(Boolean)
    .flatMap((item) => item!.split(','));
  return (
    <details className="advanced-search">
      <summary>
        More filters <span aria-hidden="true">+</span>
      </summary>
      <div className="advanced-grid">
        <fieldset>
          <legend>Rooms & comfort</legend>
          <div className="field-pair">
            <SelectField
              label="Bedrooms"
              name="bedrooms"
              choices={bedroomOptions}
              query={query}
              disabled={commercial}
            />
            <SelectField
              label="Bathrooms"
              name="bathrooms"
              choices={bathroomOptions}
              query={query}
            />
          </div>
          <SelectField label="Furnishing" name="furnishing" choices={furnishings} query={query} />
          <NumberField label="Minimum parking spaces" name="parking" query={query} />
        </fieldset>
        <fieldset>
          <legend>Size & amenities</legend>
          <div className="field-pair">
            <NumberField label="Min size (sqft)" name="minSize" query={query} step="0.01" />
            <NumberField label="Max size (sqft)" name="maxSize" query={query} step="0.01" />
          </div>
          <div className="amenity-options">
            {amenities.map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="amenities"
                  value={value}
                  defaultChecked={selected.includes(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Listing & representative</legend>
          <SelectField label="Readiness" name="ready" choices={readiness} query={query} />
          <SelectField
            label="Sale market"
            name="market"
            choices={markets}
            query={query}
            disabled={purpose !== 'buy'}
          />
          <SelectField
            label="Developer"
            name="developer"
            choices={catalogue.developers.map((item) => [item.id, item.name])}
            query={query}
          />
          <SelectField
            label="Company"
            name="company"
            choices={catalogue.companies.map((item) => [item.id, item.name])}
            query={query}
          />
          <SelectField
            label="Agent"
            name="agent"
            choices={catalogue.agents.map((item) => [item.id, item.name])}
            query={query}
          />
        </fieldset>
        {purpose === 'holiday' && (
          <fieldset>
            <legend>Holiday stay</legend>
            <NumberField label="Minimum guest capacity" name="guests" query={query} />
            <NumberField label="Length of stay (nights)" name="nights" query={query} />
          </fieldset>
        )}
      </div>
      <div className="advanced-actions">
        <button className="button" type="submit">
          Search properties →
        </button>
        <a href="/properties">Clear filters</a>
      </div>
      {first(query.q) && <input type="hidden" name="q" value={first(query.q)} />}
    </details>
  );
}

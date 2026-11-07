'use client';
import { useState } from 'react';
import type { Catalogue } from '../../lib/types';

export function CompanySearch({ catalogue }: { catalogue: Catalogue }) {
  const [mode, setMode] = useState('buy');
  const rents = mode === 'rent';
  return (
    <form className="a-search" method="get" action="/properties" onReset={() => setMode('buy')}>
      <fieldset className="a-purpose">
        <legend className="sr-only">Property collection</legend>
        {[
          ['buy', 'Buy'],
          ['rent', 'Rent'],
          ['new', 'New developments'],
          ['commercial', 'Commercial properties'],
        ].map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="purpose"
              value={value === 'rent' ? 'rent' : 'buy'}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {mode === 'new' && <input type="hidden" name="ready" value="off-plan" />}
      {mode === 'commercial' && <input type="hidden" name="category" value="commercial" />}
      <div className="a-search-fields">
        <label>
          <span className="sr-only">Location</span>
          <select name="area" defaultValue="">
            <option value="">All communities</option>
            {catalogue.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Property type</span>
          <select name="type" defaultValue="">
            <option value="">All property types</option>
            {Array.from(new Set(catalogue.listings.map((p) => p.type)))
              .sort()
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Maximum price in AED</span>
          <select key={mode} name="maxPrice" defaultValue="">
            <option value="">{rents ? 'Any annual rent (AED)' : 'Any price (AED)'}</option>
            {(rents
              ? [100000, 150000, 200000, 300000, 500000]
              : [1000000, 2500000, 5000000, 10000000, 20000000]
            ).map((price) => (
              <option key={price} value={price}>
                Up to AED {price.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Minimum size in square feet</span>
          <select name="minSize" defaultValue="">
            <option value="">All sizes (sq ft)</option>
            {[500, 1000, 2000, 5000].map((size) => (
              <option key={size} value={size}>
                {size.toLocaleString()}+ sq ft
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="a-search-bottom">
        <button className="a-more-options" type="submit">
          ＋ More options
        </button>
        <div>
          <button className="a-clear-filters" type="reset">
            Clear filters
          </button>
          <button className="a-action" type="submit">
            Show properties
          </button>
        </div>
      </div>
    </form>
  );
}

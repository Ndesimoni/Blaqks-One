'use client';
import { useState } from 'react';
import type { Catalogue } from '../../lib/types';
import { HomeverseIcon } from './HomeverseIcon';
export function HomeverseSearch({ catalogue }: { catalogue: Catalogue }) {
  const [purpose, setPurpose] = useState('buy');
  const budgets =
    purpose === 'buy'
      ? [1000000, 2500000, 5000000, 10000000]
      : purpose === 'rent'
        ? [100000, 150000, 250000, 500000]
        : [500, 1000, 2000, 5000];
  return (
    <form className="v-search" action="/properties" method="get">
      <fieldset className="v-purpose">
        <legend className="sr-only">Property purpose</legend>
        {[
          ['buy', 'Buy'],
          ['rent', 'Rent'],
          ['holiday', 'Holiday homes'],
        ].map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="purpose"
              value={value}
              checked={purpose === value}
              onChange={() => setPurpose(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <div className="v-search-fields">
        <label>
          Location
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
          Property type
          <select name="type" defaultValue="">
            <option value="">All property types</option>
            {[...new Set(catalogue.listings.map((p) => p.type))].sort().map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Budget (AED)
          {purpose !== 'buy' && (
            <span className="sr-only">{purpose === 'rent' ? 'per year' : 'per night'}</span>
          )}
          <select key={purpose} name="maxPrice" defaultValue="">
            <option value="">
              {purpose === 'buy'
                ? 'Any price'
                : purpose === 'rent'
                  ? 'Any annual rent'
                  : 'Any nightly rate'}
            </option>
            {budgets.map((price) => (
              <option key={price} value={price}>
                Up to {price.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bedrooms
          <select name="bedrooms" defaultValue="">
            <option value="">Any bedrooms</option>
            <option value="studio">Studio</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'bedroom' : 'bedrooms'}
              </option>
            ))}
            <option value="5plus">5+ bedrooms</option>
          </select>
        </label>
        <button className="v-button" type="submit">
          Search property <HomeverseIcon name="search" size={16} />
        </button>
      </div>
    </form>
  );
}

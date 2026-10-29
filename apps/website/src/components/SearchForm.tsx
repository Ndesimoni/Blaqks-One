'use client';

import { useState } from 'react';
import type { Catalogue, Query } from '../lib/types';
import {
  categories,
  commercialTypes,
  emirates,
  purposes,
  sortOptions,
  types,
} from '../lib/options';
import { first } from './ui';
import { SearchAdvanced } from './SearchAdvanced';
import { LiveSelect } from './LiveSelect';
import { SearchBudget } from './SearchBudget';

export function SearchForm({
  query = {},
  catalogue,
  compact = false,
}: {
  query?: Query;
  catalogue: Catalogue;
  compact?: boolean;
}) {
  const [purpose, setPurpose] = useState(first(query.purpose));
  const [emirate, setEmirate] = useState(first(query.emirate));
  const [area, setArea] = useState(first(query.area));
  const [category, setCategory] = useState(first(query.category));
  const [type, setType] = useState(first(query.type));
  const [minPrice, setMinPrice] = useState(first(query.minPrice));
  const [maxPrice, setMaxPrice] = useState(first(query.maxPrice));
  const [sort, setSort] = useState(first(query.sort) || 'newest');
  const areas = catalogue.areas.filter((item) => !emirate || item.emirate === emirate);
  const visibleTypes = types.filter(
    (item) =>
      !category || (commercialTypes.includes(item) ? 'commercial' : 'residential') === category,
  );
  return (
    <form className={`search-form${compact ? ' compact' : ''}`} action="/properties" method="get">
      <div className="search-core">
        <LiveSelect
          label="Purpose"
          name="purpose"
          value={purpose}
          choices={purposes}
          empty="All purposes"
          onChange={(value) => {
            setPurpose(value);
            setMinPrice('');
            setMaxPrice('');
            if (!value) setSort('newest');
          }}
        />
        <LiveSelect
          label="Emirate"
          name="emirate"
          value={emirate}
          choices={emirates}
          empty="All emirates"
          onChange={(value) => {
            setEmirate(value);
            setArea('');
          }}
        />
        <LiveSelect
          label="Community / area"
          name="area"
          value={area}
          choices={areas.map((item) => [item.id, item.name])}
          empty="All communities"
          onChange={setArea}
        />
        <LiveSelect
          label="Category"
          name="category"
          value={category}
          choices={categories}
          empty="All categories"
          onChange={(value) => {
            setCategory(value);
            setType('');
          }}
        />
        <LiveSelect
          label="Property type"
          name="type"
          value={type}
          choices={visibleTypes.map((item) => [item, item])}
          empty="All types"
          onChange={setType}
        />
        <SearchBudget
          purpose={purpose}
          min={minPrice}
          max={maxPrice}
          setMin={setMinPrice}
          setMax={setMaxPrice}
        />
        <button type="submit" className="button">
          Search properties →
        </button>
      </div>
      {!compact && (
        <label className="sort-field">
          Sort properties
          <select name="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value} disabled={value.startsWith('price-') && !purpose}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <SearchAdvanced
        query={query}
        catalogue={catalogue}
        purpose={purpose}
        commercial={category === 'commercial' || commercialTypes.includes(type)}
      />
    </form>
  );
}

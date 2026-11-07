import React, { useId, useState } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { MAX_RECIPIENTS } from './model.js';
import { filterRecipientDirectory, recipientCategories } from './recipients.js';

export function RecipientPicker({
  id,
  entries,
  channel,
  selected,
  allowed,
  focusSearch,
  onAdd,
  onClose,
}) {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const results = filterRecipientDirectory(entries, search, category);
  const atLimit = selected.length >= MAX_RECIPIENTS;
  return (
    <section className="message-recipient-picker" id={id} aria-label="Saved recipients">
      <div className="message-picker-heading">
        <strong>Choose saved recipients</strong>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close recipient picker"
          onClick={onClose}
        >
          <Icon name="close" size={17} />
        </button>
      </div>
      <label htmlFor={searchId}>Search recipients</label>
      <div className="search-small">
        <Icon name="search" size={17} />
        <input
          id={searchId}
          type="search"
          placeholder="Search name, email or phone"
          value={search}
          autoFocus={focusSearch}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
        />
      </div>
      <div className="message-recipient-filters" role="group" aria-label="Recipient categories">
        {recipientCategories.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={category === value}
            onClick={() => {
              setCategory(value);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <small className="message-picker-count" role="status">
        {results.length} {results.length === 1 ? 'match' : 'matches'} · Showing{' '}
        {channel === 'email' ? 'email addresses' : 'WhatsApp numbers'}
      </small>
      {results.length ? (
        <OverflowList
          mode="scroll"
          className="recipient-results-list"
          key={`${category}:${search}`}
          items={results}
          getKey={(entry) => entry.key}
          label="Matching recipients"
          listClassName="message-recipient-results"
          renderItem={(entry) => {
            const added = entry.available && selected.includes(entry.address);
            const detail = entry.available
              ? entry.address
              : entry.address
                ? `Check saved ${channel === 'email' ? 'email' : 'phone'}: ${entry.address}`
                : `No ${channel === 'email' ? 'email' : 'phone'} recorded`;
            return (
              <button
                type="button"
                className={`message-recipient-option${added ? ' selected' : ''}`}
                disabled={!entry.available || added || atLimit || !allowed}
                aria-label={`${added ? 'Added' : 'Add'} ${entry.name}: ${detail}`}
                onClick={() => onAdd(entry.address)}
              >
                <Icon name={added ? 'check' : 'plus'} size={17} />
                <span className="message-recipient-person">
                  <strong>{entry.name}</strong>
                  <small>{detail}</small>
                  <span className="message-recipient-category">{entry.categories.join(' · ')}</span>
                </span>
                <span className="message-recipient-state">
                  {added
                    ? 'Added'
                    : !entry.available
                      ? 'Unavailable'
                      : atLimit
                        ? 'Limit reached'
                        : 'Add'}
                </span>
              </button>
            );
          }}
        />
      ) : (
        <p className="message-picker-empty">
          No matching recipients. Try another category or search, or enter details manually.
        </p>
      )}
      {atLimit && (
        <p className="team-muted">
          Up to {MAX_RECIPIENTS} recipients per preview. Remove one to add another.
        </p>
      )}
    </section>
  );
}

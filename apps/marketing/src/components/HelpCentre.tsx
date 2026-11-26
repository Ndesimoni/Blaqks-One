'use client';
import { useState } from 'react';
import { help, searchHelp, topics } from '@/lib/help';
import { Faq } from './Faq';

/** Search and topic filters over the help answers. */
export function HelpCentre() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const items = searchHelp(help, query, topic);
  return (
    <>
      <div className="help-search">
        <label className="sr" htmlFor="help-query">
          Search the help centre
        </label>
        <input
          id="help-query"
          type="search"
          placeholder="Search, for example “invite my team”"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="help-topics" role="group" aria-label="Topics">
        {topics.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={topic === name}
            onClick={() => setTopic(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {items.length ? (
        <Faq key={topic + query} items={items} />
      ) : (
        <p className="alt" role="status">
          No answers match “{query}”.{' '}
          <button type="button" className="link" onClick={() => (setQuery(''), setTopic('All'))}>
            Clear search
          </button>
        </p>
      )}
    </>
  );
}

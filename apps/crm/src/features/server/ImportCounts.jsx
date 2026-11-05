import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { connectedCollections } from './records.js';

export function ImportCounts({ counts, skipped, deferred }) {
  return (
    <div className="record-review">
      <dl className="record-review-grid">
        {connectedCollections.map((name) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>
              {counts?.[name] || 0}
              {skipped && ` to import · ${skipped[name] || 0} already saved`}
            </dd>
          </div>
        ))}
      </dl>
      {deferred && Object.keys(deferred).length > 0 && (
        <section className="review-section">
          <h3>Other records stay in your source</h3>
          <OverflowList
            items={Object.entries(deferred)}
            getKey={([name]) => name}
            label="Collections awaiting backend support"
            renderItem={([name, count]) => (
              <span>
                {name}: {count}
              </span>
            )}
          />
          <p>
            These collections are not imported in this stage. Keep your browser data or backup for
            the next migration stage.
          </p>
        </section>
      )}
    </div>
  );
}

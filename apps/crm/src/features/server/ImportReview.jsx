import React from 'react';
import { ImportCounts } from './ImportCounts.jsx';

export function ImportReview({ preview, draft, targetName }) {
  return (
    <div className="record-review">
      <section className="review-section">
        <h3>Review your import</h3>
        <p>
          <strong>From:</strong> {preview.sourceLabel}
        </p>
        <p>
          <strong>To:</strong> {targetName}
        </p>
        <p>
          <strong>Photos:</strong>{' '}
          {draft.demoPhotos
            ? 'Demo photos added only to properties without uploaded photos.'
            : 'Keep the original property media.'}
        </p>
      </section>
      <ImportCounts
        counts={preview.counts}
        skipped={preview.skipped}
        deferred={draft.source.deferred}
      />
      <p className="form-intro">
        Only new records are added. Identical existing records are skipped. Different records with
        the same ID stop the import.
      </p>
      <p>
        Your browser records and backup file are preserved. No properties are published by this
        import.
      </p>
    </div>
  );
}

import React from 'react';
import { Button } from './Button.jsx';
import { downloadBlob } from '../../services/files/download.js';
import { Link } from 'react-router-dom';

export function StorageRecovery({ recovery, retryLoad, startEmpty, returnLink }) {
  return (
    <main className="recovery-page">
      <section className="panel recovery-panel" aria-labelledby="recovery-title">
        <h1 id="recovery-title">Recover your workspace</h1>
        <p role="alert">{recovery.error}</p>
        <p>
          Your saved records have been left untouched. Download the original data before replacing
          them, or retry after fixing the browser storage.
        </p>
        <div className="recovery-actions">
          {returnLink && (
            <Link className="btn btn-light" to={returnLink}>
              Return to my workspace
            </Link>
          )}
          {recovery.raw !== null && (
            <Button
              variant="light"
              onClick={() =>
                downloadBlob(
                  new Blob([recovery.raw], { type: 'application/json' }),
                  'Keys_with_Simoni_Recovery.json',
                )
              }
            >
              Download saved data
            </Button>
          )}
          <Button onClick={retryLoad}>Retry opening workspace</Button>
          <Button
            variant="danger-light"
            onClick={() => {
              if (
                confirm(
                  'Start an empty workspace? This replaces saved records in this browser. Download the saved data first if you need it.',
                )
              )
                startEmpty();
            }}
          >
            {recovery.raw === null
              ? 'Continue with empty workspace'
              : 'Replace with empty workspace'}
          </Button>
        </div>
      </section>
    </main>
  );
}

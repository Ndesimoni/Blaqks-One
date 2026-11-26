import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceBoardCard } from './MarketplaceBoardCard.jsx';
import { MarketplaceBoardFilters } from './MarketplaceBoardFilters.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { MarketplaceRequestActivity } from './MarketplaceRequestActivity.jsx';
import { useBoard } from './useRequests.js';

const noFilters = Object.freeze({
  purpose: '',
  emirate: '',
  propertyType: '',
  bedrooms: '',
  band: '',
});

/**
 * Open client requests as a grid of cards, filtered on the server and paged (packet MK2).
 * An empty board says whether nothing is posted or nothing matches the filters.
 */
export function MarketplaceBoard() {
  const { t } = useI18n();
  const [filters, setFilters] = useState(noFilters);
  const board = useBoard(filters);
  const [broker, setBroker] = useState('');
  const [opened, setOpened] = useState(null);
  const filtered = Object.values(filters).some(Boolean);
  return (
    <div className="market-board">
      <p className="market-note">{t('marketplaceRequests.board.text')}</p>
      <MarketplaceBoardFilters
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(noFilters)}
      />
      {board.loading && !board.requests.length && (
        <p role="status">{t('marketplaceRequests.board.loading')}</p>
      )}
      {board.error && (
        <p className="field-error" role="alert">
          {board.error}
        </p>
      )}
      {!board.loading && !board.error && !board.requests.length && (
        <div className="market-empty">
          {filtered ? (
            <p>{t('marketplaceRequests.board.empty')}</p>
          ) : (
            <>
              <strong>{t('marketplaceBoard.empty.title')}</strong>
              <p>{t('marketplaceBoard.empty.text')}</p>
            </>
          )}
        </div>
      )}
      <ul className="market-board-list">
        {board.requests.map((request) => (
          <MarketplaceBoardCard
            key={request.id}
            request={request}
            onOpenBroker={setBroker}
            onOpenRequest={() => setOpened(request)}
          />
        ))}
      </ul>
      {board.nextCursor && (
        <Button variant="light" onClick={board.loadMore} disabled={board.more}>
          {board.more
            ? t('marketplaceRequests.board.loading')
            : t('marketplaceRequests.board.loadMore')}
        </Button>
      )}
      {broker && <MarketplaceProfileDialog memberId={broker} onClose={() => setBroker('')} />}
      {opened && (
        <MarketplaceRequestActivity
          requestId={opened.id}
          summary={opened}
          onClose={() => setOpened(null)}
          onChanged={board.retry}
        />
      )}
    </div>
  );
}

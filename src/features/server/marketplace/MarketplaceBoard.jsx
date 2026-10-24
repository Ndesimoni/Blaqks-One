import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceBoardCard } from './MarketplaceBoardCard.jsx';
import { MarketplaceBoardFilters } from './MarketplaceBoardFilters.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { useBoard } from './useRequests.js';

const noFilters = Object.freeze({
  purpose: '',
  emirate: '',
  propertyType: '',
  bedrooms: '',
  band: '',
});

/** Other companies' open requests, filtered on the server and paged (packet MK2). */
export function MarketplaceBoard() {
  const { t } = useI18n();
  const [filters, setFilters] = useState(noFilters);
  const board = useBoard(filters);
  const [broker, setBroker] = useState('');
  return (
    <div className="market-board">
      <MarketplaceBoardFilters filters={filters} onChange={setFilters} />
      {board.loading && !board.requests.length && (
        <p role="status">{t('marketplaceRequests.board.loading')}</p>
      )}
      {board.error && (
        <p className="field-error" role="alert">
          {board.error}
        </p>
      )}
      {!board.loading && !board.error && !board.requests.length && (
        <p className="market-empty">{t('marketplaceRequests.board.empty')}</p>
      )}
      <ul className="market-board-list">
        {board.requests.map((request) => (
          <MarketplaceBoardCard key={request.id} request={request} onOpenBroker={setBroker} />
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
    </div>
  );
}

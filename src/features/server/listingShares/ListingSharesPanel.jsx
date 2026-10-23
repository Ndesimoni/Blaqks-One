import React, { useState } from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ListingShareDetail } from './ListingShareDetail.jsx';
import { ListingShareRow } from './ListingShareRow.jsx';
import { useListingShareList } from './useListingShares.js';
import './listing-shares.css';

const SIDES = ['incoming', 'sent'];
const PAGE = 12;

/** One side's shares, newest first; remounted per side so no other side's rows linger. */
function SideList({ side }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const list = useListingShareList(side);
  const shown = list.shares.slice(page * PAGE, (page + 1) * PAGE);
  return (
    <>
      {list.loading && !list.value && <p role="status">{k('loading')}</p>}
      {list.error && !list.value && (
        <p className="field-error" role="alert">
          {k('loadFailed')}
        </p>
      )}
      {list.value && !list.shares.length && (
        <section className="panel agreements-empty">
          <Empty
            icon="building"
            title={k(`empty.${side}.title`)}
            detail={k(`empty.${side}.text`)}
          />
        </section>
      )}
      {shown.length > 0 && (
        <ul className="agreements-list" aria-label={k(`side.${side}`)}>
          {shown.map((share) => (
            <ListingShareRow key={share.id} share={share} onOpen={() => setOpenId(share.id)} />
          ))}
        </ul>
      )}
      {list.shares.length > PAGE && (
        <Pagination
          total={list.shares.length}
          page={page}
          pageSize={PAGE}
          label={k('pagesLabel')}
          itemLabel={k('itemLabel')}
          onChange={setPage}
        />
      )}
      {openId && (
        <ListingShareDetail id={openId} onChanged={list.reload} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

/**
 * Agreements → Listings (record sharing R2): listings shared with the caller by agents at
 * other companies, and the ones the caller shared, twelve per page. This is the only home
 * of outside listings: they never enter the Properties list, pickers or exports.
 */
export function ListingSharesPanel() {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const [side, setSide] = useState('incoming');
  return (
    <section className="listing-shares-panel" aria-label={k('panelLabel')}>
      <div role="tablist" aria-label={k('sidesLabel')} className="agreements-tabs listing-sides">
        {SIDES.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={side === name}
            className={'agreements-tab' + (side === name ? ' is-active' : '')}
            onClick={() => setSide(name)}
          >
            {k(`side.${name}`)}
          </button>
        ))}
      </div>
      <SideList key={side} side={side} />
    </section>
  );
}

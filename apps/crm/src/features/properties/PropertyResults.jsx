import React from 'react';
import { get } from '../../lib/records.js';
import { Button } from '../../components/ui/Button.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { PropertyCard } from './PropertyCard.jsx';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';

export function PropertyResults({ result, currentPage, resultsRef, changePage, resetFilters }) {
  const { dispatchRow } = useWorkspaceActions();
  const pageSize = 12;
  return (
    <section
      ref={resultsRef}
      className="inventory-collection"
      aria-label="Property results"
      tabIndex={-1}
    >
      <OverflowList
        mode="all"
        items={result.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
        getKey={(p, i) => get(p, 'Property ID') || i}
        label="Property listings"
        listClassName="property-grid property-grid-refined"
        className="inventory-property-list"
        renderItem={(property, index) => (
          <PropertyCard
            property={property}
            index={index}
            onSelect={() => dispatchRow('Properties', property)}
          />
        )}
        after={
          result.length === 0 && (
            <div className="inventory-empty">
              <Empty
                title="No properties match those filters"
                detail="Try another property type or clear your filters to see the full portfolio."
                icon="search"
                action={
                  <Button variant="light" onClick={resetFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          )
        }
      />
      <Pagination
        total={result.length}
        page={currentPage}
        pageSize={pageSize}
        label="Property pages"
        itemLabel="properties"
        onChange={changePage}
      />
    </section>
  );
}

import React, { useRef, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Pagination } from '../../../../components/ui/Pagination.jsx';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useSession } from '../../../../hooks/useSession.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ListEmpty, ListError, ListSkeleton } from '../WebsiteListStates.jsx';
import { CompanyEligibilityDialog } from './CompanyEligibilityDialog.jsx';
import { CompanyFilters } from './CompanyFilters.jsx';
import { CompanyRows } from './CompanyRows.jsx';
import { filterCompanies, filterCounts, pageOf, PAGE_SIZE } from './companiesModel.js';
import { useWebsiteCompanies } from './useWebsiteCompanies.js';
import '../website-lists.css';
import './website-companies.css';

function CompaniesList({ api }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteCompanies.${key}`, vars);
  const mobile = useMediaQuery('(max-width: 850px)');
  const list = useWebsiteCompanies(api, k('loadError'));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const searchRef = useRef(null);
  const change = (setter) => (value) => {
    setter(value);
    setPage(0);
  };
  const clear = () => {
    setQuery('');
    setFilter('all');
    setPage(0);
    searchRef.current?.focus();
  };
  if (list.loading) return <ListSkeleton label={k('loading')} />;
  if (!list.rows)
    return <ListError message={list.error} retryLabel={k('retry')} onRetry={list.reload} />;
  const filtered = filterCompanies(list.rows, { query, filter });
  const { current, items } = pageOf(filtered, page);
  const row = editing && list.rows.find((item) => item.workspace === editing);
  return (
    <>
      <CompanyFilters
        query={query}
        filter={filter}
        counts={filterCounts(list.rows, query)}
        onQuery={change(setQuery)}
        onFilter={change(setFilter)}
        onClear={clear}
        searchRef={searchRef}
      />
      <p className="website-list-status" role="status">
        {notice}
      </p>
      {list.error && (
        <p className="field-error" role="alert">
          {list.error}
        </p>
      )}
      {!list.rows.length ? (
        <ListEmpty title={k('empty')} detail={k('emptyDetail')} />
      ) : !filtered.length ? (
        <ListEmpty
          title={k('noMatches')}
          detail={k('noMatchesDetail')}
          icon="search"
          action={
            <Button variant="light" onClick={clear}>
              {k('clear')}
            </Button>
          }
        />
      ) : (
        <CompanyRows
          rows={items}
          mobile={mobile}
          onEdit={(workspace) => {
            setNotice('');
            setEditing(workspace);
          }}
        />
      )}
      {filtered.length > 0 && (
        <Pagination
          total={filtered.length}
          page={current}
          pageSize={PAGE_SIZE}
          label={k('pages')}
          itemLabel={k('items')}
          onChange={setPage}
        />
      )}
      {row && (
        <CompanyEligibilityDialog
          api={api}
          row={row}
          onClose={() => setEditing(null)}
          onReload={list.reload}
          onSaved={(site, saved) => {
            list.replace({ ...site, workspace: saved.workspace });
            setEditing(null);
            setNotice(k('saved', { company: saved.company }));
          }}
        />
      )}
    </>
  );
}

/** Super Admin "Companies" tab of Platform website: company website eligibility. */
export function WebsiteCompanies() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key) => t(`websiteCompanies.${key}`);
  return (
    <section className="website-list" aria-labelledby="website-companies-title">
      <div className="website-list-head">
        <h2 id="website-companies-title">{k('title')}</h2>
        <p>{k('intro')}</p>
      </div>
      {user.roleId === 'super-admin' ? (
        <CompaniesList api={api} />
      ) : (
        <section className="panel recovery-panel">
          <p>{k('restricted')}</p>
        </section>
      )}
    </section>
  );
}

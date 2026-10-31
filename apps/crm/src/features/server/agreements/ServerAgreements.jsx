import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementDetail } from './AgreementDetail.jsx';
import { AgreementForm } from './AgreementForm.jsx';
import { AgreementList } from './AgreementList.jsx';
import { ListingSharesPanel } from '../listingShares/ListingSharesPanel.jsx';
import { filterByTab, TABS } from './agreementModel.js';
import { useAgreements } from './useAgreements.js';
import './agreements.css';
import './agreement-rows.css';
import './agreement-detail.css';
import './agreement-terms.css';
import './agreement-form.css';
import './agreement-lifecycle.css';

/**
 * Agreements (docs/agreements-design.md §13): offers between this company and another,
 * filtered Incoming / Sent / All, and Listings shared between companies (record sharing R2).
 * The detail opens over the list; drafts, revisions and counter-offers use one form that
 * freezes the reviewed terms into a new revision.
 */
export function ServerAgreements() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const list = useAgreements(api, user.workspaceId);
  const [tab, setTab] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const counts = Object.fromEntries(
    TABS.map((name) => [name, filterByTab(list.items, name, user.workspaceId, user.id).length]),
  );
  const saved = (id) => {
    setForm(null);
    setOpenId(id);
    list.reload();
  };
  const closeForm = () => {
    // Revising or countering returns to the agreement it started from.
    setOpenId(form?.detail?.agreement.id ?? null);
    setForm(null);
  };
  return (
    <div className="agreements-page">
      <div className="agreements-toolbar">
        <div role="tablist" aria-label={t('agreements.tabs.label')} className="agreements-tabs">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              className={'agreements-tab' + (tab === name ? ' is-active' : '')}
              onClick={() => setTab(name)}
            >
              {t(`agreements.tabs.${name}`)}
              <span className="agreements-tab-count">{counts[name]}</span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'listings'}
            className={'agreements-tab' + (tab === 'listings' ? ' is-active' : '')}
            onClick={() => setTab('listings')}
          >
            {t('listingShares.tab')}
          </button>
        </div>
        {tab !== 'listings' && (
          <Button icon="plus" onClick={() => setForm({ mode: 'create' })}>
            {t('agreements.new')}
          </Button>
        )}
      </div>
      {tab === 'listings' ? (
        <ListingSharesPanel />
      ) : (
        <AgreementList
          key={tab}
          list={list}
          tab={tab}
          onOpen={setOpenId}
          onCreate={() => setForm({ mode: 'create' })}
        />
      )}
      {openId && !form && (
        <AgreementDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={list.reload}
          onEdit={(mode, detail) => setForm({ mode, detail })}
        />
      )}
      {form && (
        <AgreementForm mode={form.mode} detail={form.detail} onClose={closeForm} onSaved={saved} />
      )}
    </div>
  );
}

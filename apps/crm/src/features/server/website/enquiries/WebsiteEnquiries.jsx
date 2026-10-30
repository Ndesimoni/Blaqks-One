import React, { useState } from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { Pagination } from '../../../../components/ui/Pagination.jsx';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useSession } from '../../../../hooks/useSession.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ListEmpty, ListError, ListSkeleton } from '../WebsiteListStates.jsx';
import { EnquiryMessageDialog } from './EnquiryMessageDialog.jsx';
import { EnquiryRows } from './EnquiryRows.jsx';
import { PAGE_SIZE } from './enquiriesModel.js';
import { useOpenLead } from './useOpenLead.js';
import { useWebsiteEnquiries } from './useWebsiteEnquiries.js';
import '../website-lists.css';
import './website-enquiries.css';

/**
 * Admin "Enquiries" tab of Website: enquiries from the company website and the general
 * site, newest first, each with the lead it created. `siteId` is the company site's id,
 * which tells Company site from General site.
 */
export function WebsiteEnquiries({ siteId = null }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteEnquiries.${key}`, vars);
  const workspace = user.workspaceId || user.id;
  const mobile = useMediaQuery('(max-width: 850px)');
  const list = useWebsiteEnquiries(api, workspace, k('loadError'));
  const lead = useOpenLead();
  const [reading, setReading] = useState(null);
  const [notice, setNotice] = useState('');
  const context = { titles: list.titles, names: list.names, userId: user.id, siteId };
  const actions = {
    leadReady: lead.ready,
    onRead: setReading,
    onOpenLead: (leadId) => setNotice(lead.open(leadId) ? '' : k('leadMissing')),
  };
  const open = reading && list.rows.find((enquiry) => enquiry.id === reading);
  return (
    <section className="website-list" aria-labelledby="website-enquiries-title">
      <div className="website-list-head">
        <h2 id="website-enquiries-title">{k('title')}</h2>
        <div className="website-list-notes">
          <p className="website-list-note">
            <Icon name="lock" size={14} />
            {k('privateNote')}
          </p>
          <p className="website-list-note">{k('marketingNote')}</p>
        </div>
      </div>
      <p className="website-list-status" role="status">
        {notice}
      </p>
      {list.status === 'loading' ? (
        <ListSkeleton label={k('loading')} />
      ) : list.status === 'error' ? (
        <ListError message={list.error} retryLabel={k('retry')} onRetry={list.reload} />
      ) : !list.total ? (
        <ListEmpty title={k('empty')} detail={k('emptyDetail')} icon="chat" />
      ) : (
        <>
          <EnquiryRows rows={list.rows} mobile={mobile} context={context} actions={actions} />
          <Pagination
            total={list.total}
            page={list.page}
            pageSize={PAGE_SIZE}
            label={k('pages')}
            itemLabel={k('items')}
            onChange={(page) => {
              setNotice('');
              list.setPage(page);
            }}
          />
        </>
      )}
      {open && (
        <EnquiryMessageDialog enquiry={open} context={context} onClose={() => setReading(null)} />
      )}
    </section>
  );
}

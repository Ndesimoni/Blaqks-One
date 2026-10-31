import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FinanceDialog } from '../../finance/FinanceDialog.jsx';
import { preference } from './enquiriesModel.js';
import { Received, Sender, enquiryView } from './EnquiryParts.jsx';

/** The full enquiry message with who sent it and where from; read-only, Close only. */
export function EnquiryMessageDialog({ enquiry, context, onClose }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`websiteEnquiries.${key}`, vars);
  const view = enquiryView(enquiry, { ...context, k });
  const channel = preference(enquiry);
  return (
    <FinanceDialog
      eyebrow={k('dialogEyebrow')}
      title={k('dialogTitle', { name: view.name })}
      onClose={onClose}
      dismissLabel={k('close')}
      className="website-enquiry-dialog"
    >
      <div className="website-enquiry-from">
        <Sender view={view} k={k} />
        {channel && (
          <span className="website-list-sub">
            {k('prefers', { channel: k(`channel.${channel}`) })}
          </span>
        )}
      </div>
      <dl className="website-enquiry-facts">
        <div>
          <dt>{k('received')}</dt>
          <dd>
            <Received instant={view.instant} format={format} />
          </dd>
        </div>
        {[
          ['about', view.about],
          ['site', view.site],
          ['assigned', view.assignee],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{k(name)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="website-enquiry-message">
        <h3>{k('message')}</h3>
        <p>{view.message}</p>
      </section>
      <p className="website-list-note">{k('marketingNote')}</p>
    </FinanceDialog>
  );
}

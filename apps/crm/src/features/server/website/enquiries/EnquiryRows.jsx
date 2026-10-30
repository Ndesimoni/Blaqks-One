import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { EnquiryActions, Received, Sender, enquiryView } from './EnquiryParts.jsx';

const COLUMNS = ['received', 'from', 'about', 'site', 'assigned', 'lead'];

/**
 * Enquiries as a native table on wide screens, or cards with a two-line message preview on
 * phones. `context` carries titles, member names, the viewer and the company site id.
 */
export function EnquiryRows({ rows, mobile, context, actions }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`websiteEnquiries.${key}`, vars);
  const views = rows.map((enquiry) => [enquiry, enquiryView(enquiry, { ...context, k })]);
  if (mobile)
    return (
      <ul className="website-list-cards">
        {views.map(([enquiry, view]) => (
          <li key={enquiry.id} className="panel website-list-card" data-enquiry={enquiry.id}>
            <div className="website-enquiry-from">
              <Sender view={view} k={k} />
            </div>
            <p className="website-enquiry-preview">{view.message}</p>
            <dl>
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
            <EnquiryActions enquiry={enquiry} view={view} k={k} {...actions} />
          </li>
        ))}
      </ul>
    );
  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table website-list-table" aria-label={k('table')}>
          <thead>
            <tr>
              {COLUMNS.map((name) => (
                <th key={name} scope="col">
                  {k(name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {views.map(([enquiry, view]) => (
              <tr key={enquiry.id} data-enquiry={enquiry.id}>
                <td>
                  <Received instant={view.instant} format={format} />
                </td>
                <td>
                  <div className="website-enquiry-from">
                    <Sender view={view} k={k} />
                  </div>
                </td>
                <td>{view.about}</td>
                <td>{view.site}</td>
                <td>{view.assignee}</td>
                <td>
                  <EnquiryActions enquiry={enquiry} view={view} k={k} {...actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

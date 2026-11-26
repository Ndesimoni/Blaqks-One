import React from 'react';
import {
  TeamActions,
  TeamConsent,
  TeamLive,
  TeamPerson,
  TeamProfile,
  TeamPublishing,
} from './WebsiteTeamCells.jsx';

const COLUMNS = ['person', 'profile', 'consent', 'publishing', 'live', 'actions'];

/** Desktop: one native table, its wide layout scrolling inside the table only. */
export function WebsiteTeamTable({ rows, actions, t }) {
  return (
    <div className="table-shell wt-table-shell">
      <div className="table-scroll">
        <table className="data-table wt-table" aria-label={t('websiteTeam.label')}>
          <thead>
            <tr>
              {COLUMNS.map((key) => (
                <th scope="col" key={key}>
                  {t(`websiteTeam.col.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.member.id} data-member-id={row.member.id}>
                <th scope="row">
                  <TeamPerson row={row} t={t} />
                </th>
                <td>
                  <TeamProfile row={row} t={t} />
                </td>
                <td>
                  <TeamConsent row={row} actions={actions} t={t} />
                </td>
                <td>
                  <TeamPublishing row={row} actions={actions} t={t} />
                </td>
                <td>
                  <TeamLive row={row} t={t} />
                </td>
                <td>
                  <TeamActions row={row} actions={actions} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Phone width: one card per person, status first, then labelled details and actions. */
export function WebsiteTeamCards({ rows, actions, t }) {
  const label = (key) => t(`websiteTeam.col.${key}`);
  return (
    <ul className="wt-cards" aria-label={t('websiteTeam.label')}>
      {rows.map((row) => (
        <li key={row.member.id} className="panel wt-card" data-member-id={row.member.id}>
          <TeamPerson row={row} heading="h3" t={t} />
          <TeamProfile row={row} t={t} />
          <dl className="wt-card-details">
            <div>
              <dt>{label('consent')}</dt>
              <dd>
                <TeamConsent row={row} actions={actions} t={t} />
              </dd>
            </div>
            <div>
              <dt>{label('live')}</dt>
              <dd>
                <TeamLive row={row} t={t} />
              </dd>
            </div>
            <div className="wt-card-wide">
              <dt>{label('publishing')}</dt>
              <dd>
                <TeamPublishing row={row} actions={actions} t={t} />
              </dd>
            </div>
          </dl>
          <TeamActions row={row} actions={actions} t={t} />
        </li>
      ))}
    </ul>
  );
}

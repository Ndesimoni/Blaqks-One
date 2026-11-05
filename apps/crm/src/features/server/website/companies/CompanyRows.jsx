import React from 'react';
import { Badge } from '../../../../components/ui/Badge.jsx';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';

/** Yes/No badges always carry their text; colour only repeats it. */
function Flag({ on, k }) {
  return <Badge tone={on ? 'green' : 'slate'}>{k(on ? 'yes' : 'no')}</Badge>;
}

function cells(row, k) {
  return {
    address: row.host || <span className="website-list-sub">{k('noAddress')}</span>,
    visibility: (
      <Badge tone={row.active ? 'green' : 'slate'}>{k(row.active ? 'visible' : 'hidden')}</Badge>
    ),
    entitled: <Flag on={row.entitled} k={k} />,
    licence: <Flag on={row.licenceVerified} k={k} />,
  };
}

function EditButton({ row, k, onEdit }) {
  return (
    <Button
      variant="light"
      icon="edit"
      aria-label={k('editFor', { company: row.company })}
      onClick={() => onEdit(row.workspace)}
    >
      {k('edit')}
    </Button>
  );
}

/** Desktop table, or labelled cards on narrow screens; one Edit eligibility per company. */
export function CompanyRows({ rows, mobile, onEdit }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteCompanies.${key}`, vars);
  if (mobile)
    return (
      <ul className="website-list-cards">
        {rows.map((row) => {
          const cell = cells(row, k);
          return (
            <li
              key={row.workspace}
              className="panel website-list-card"
              data-workspace={row.workspace}
            >
              <div>
                <h3>{row.company}</h3>
                <span className="website-list-sub">{row.name}</span>
              </div>
              <dl>
                {['address', 'visibility', 'entitled', 'licence'].map((name) => (
                  <div key={name}>
                    <dt>{k(name)}</dt>
                    <dd>{cell[name]}</dd>
                  </div>
                ))}
              </dl>
              <EditButton row={row} k={k} onEdit={onEdit} />
            </li>
          );
        })}
      </ul>
    );
  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table website-list-table" aria-label={k('table')}>
          <thead>
            <tr>
              {['company', 'name', 'address', 'visibility', 'entitled', 'licence', 'actions'].map(
                (name) => (
                  <th key={name} scope="col">
                    {k(name)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cell = cells(row, k);
              return (
                <tr key={row.workspace} data-workspace={row.workspace}>
                  <td>
                    <strong>{row.company}</strong>
                  </td>
                  <td>{row.name}</td>
                  <td className="website-list-address">{cell.address}</td>
                  <td>{cell.visibility}</td>
                  <td>{cell.entitled}</td>
                  <td>{cell.licence}</td>
                  <td>
                    <EditButton row={row} k={k} onEdit={onEdit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

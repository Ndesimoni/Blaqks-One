import React, { useId } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

/**
 * A details section listing related records. Each row opens its record; an optional phone
 * renders as a separate tel: link so the two actions stay distinct for keyboard and touch.
 */
export function RelatedRecords({ icon, title, note, items, row, onOpen, empty }) {
  const headingId = useId();
  return (
    <section className="media-detail-block related-records" aria-labelledby={headingId}>
      <div className="detail-section-heading">
        <Icon name={icon} size={18} />
        <h3 id={headingId}>{title}</h3>
      </div>
      {note && <p className="related-records-note">{note}</p>}
      {items.length ? (
        <OverflowList
          items={items}
          getKey={(item) => row(item).key}
          label={title}
          listClassName="related-record-list"
          renderItem={(item) => <RelatedRecordRow {...row(item)} onOpen={() => onOpen(item)} />}
        />
      ) : (
        <p className="property-muted">{empty}</p>
      )}
    </section>
  );
}

function RelatedRecordRow({ primary, secondary, phone, tel, onOpen }) {
  return (
    <div className="related-record">
      <button type="button" className="related-record-open" onClick={onOpen}>
        <span className="related-record-text">
          <strong>{primary}</strong>
          {secondary && <small>{secondary}</small>}
        </span>
        <Icon name="chevron" size={15} />
      </button>
      {tel && (
        <a className="related-record-phone" href={tel}>
          {phone}
        </a>
      )}
    </div>
  );
}

import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { compactDate, today } from '../../lib/dates.js';
import { AED } from '../../lib/format.js';
import { get } from '../../lib/records.js';
import { useRecordAccess } from '../records/useRecordAccess.js';
import { mediaPhotos } from '../../lib/media.js';
import { demoListingPhoto } from '../../lib/demoPropertyPhotos.js';
import { PropertyCardImage } from '../properties/PropertyCardImage.jsx';

/** Curated matches; Shortlist appears only when Shortlist records may be created. */
export function ClientMatches({ client, matches }) {
  const { add } = useWorkspaceActions();
  const canShortlist = useRecordAccess()('Shortlist', 'create');
  return (
    <section className="panel">
      <TitleSection
        heading="Curated property matches"
        caption="Filtered by location, purpose and maximum budget"
        action={
          <span className="mini-count">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        }
      />
      {matches.length ? (
        <OverflowList
          mode="scroll"
          className="match-results-list"
          key={get(client, 'Client ID')}
          items={matches}
          getKey={(p) => get(p, 'Property ID')}
          label="Matching properties"
          listClassName="match-grid"
          renderItem={(p, index, { close }) => (
            <div className="match-card">
              <PropertyCardImage
                property={p}
                cover={mediaPhotos(p)[0] || demoListingPhoto(p)}
                hasPhotos={Boolean(mediaPhotos(p).length)}
                index={index}
              />
              <div className="match-top">
                <span className="match-icon">
                  <Icon name="building" size={18} />
                </span>
                <Badge>{get(p, 'Listing status')}</Badge>
              </div>
              <h4>{get(p, 'Listing title')}</h4>
              <div className="match-where">
                <Icon name="pin" size={14} />
                {get(p, 'Community')}
              </div>
              <div className="match-facts">
                <span>{get(p, 'Property type') || 'Property'}</span>
                <span>{get(p, 'Bedrooms') ? `${get(p, 'Bedrooms')} beds` : 'Bedrooms —'}</span>
                <span>{get(p, 'Area sq ft') ? `${get(p, 'Area sq ft')} sq ft` : 'Area —'}</span>
              </div>
              <div className="match-foot">
                <strong>{AED(get(p, 'Price / annual rent AED'))}</strong>
                {canShortlist && (
                  <button
                    onClick={() => {
                      close();
                      add('Shortlist', {
                        client_id: get(client, 'Client ID'),
                        property_id: get(p, 'Property ID'),
                        date_sent: today(),
                        client_response: 'Pending',
                      });
                    }}
                  >
                    Shortlist <Icon name="plus" size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <Empty
          title="No exact matches found"
          detail="Adjust the client's budget or locations, or add more properties to your portfolio."
          icon="home"
        />
      )}
    </section>
  );
}

export function ClientTimeline({ timeline }) {
  return (
    <section className="panel">
      <TitleSection
        heading="Relationship timeline"
        caption="Recent calls, tasks and scheduled viewings"
      />
      <div className="timeline">
        {timeline.map((item, i) => (
          <div className="timeline-item" key={i}>
            <span className="timeline-dot">
              <Icon name={item.icon} size={15} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail || '—'}</p>
            </div>
            <time>{compactDate(item.date)}</time>
          </div>
        ))}
        {!timeline.length && <div className="mini-quiet">No activity yet.</div>}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Area } from '../lib/types';
import { communityView } from '../lib/community-map';

export function AreaMap({ area, listing }: { area?: Area; listing: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('The community map loads as you approach this section.');
  const map = communityView(area);
  useEffect(() => {
    if (!root.current || !map || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (!loaded) return;
    setStatus('Loading the community map from OpenStreetMap…');
    const timer = setTimeout(
      () => setStatus('If the map does not appear, retry or open the community map below.'),
      10000,
    );
    return () => clearTimeout(timer);
  }, [loaded, attempt]);
  return (
    <section id="location" className="detail-section">
      <p className="eyebrow">THE NEIGHBOURHOOD</p>
      <h2>Location & neighbourhood</h2>
      <h3>{area?.name || 'Area details available from the agent'}</h3>
      {area && <p className="muted">{area.city}, United Arab Emirates</p>}
      <p className="muted">Approximate location. Exact address available from the listing agent.</p>
      {map ? (
        <div className="community-map" ref={root}>
          <div className="map-stage">
            {loaded ? (
              <iframe
                key={attempt}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(map.bounds)}&layer=mapnik`}
                title={`Map of ${area?.name} — approximate community location`}
                referrerPolicy="no-referrer"
                loading="lazy"
                onLoad={() =>
                  setStatus('Community view only. If the map does not appear, open it below.')
                }
                onError={() =>
                  setStatus('The map could not load. Retry or open the community map below.')
                }
              />
            ) : (
              <div className="map-placeholder">
                <span aria-hidden="true">⌖</span>
                <strong>{area?.name}</strong>
                <p>Community view · No property pin</p>
              </div>
            )}
          </div>
          <div className="map-caption">
            <p role="status">{status}</p>
            <button
              className="button quiet"
              type="button"
              onClick={() => {
                setLoaded(true);
                setAttempt((value) => value + 1);
              }}
            >
              {loaded ? 'Reload map' : 'Load map'}
            </button>
          </div>
        </div>
      ) : (
        <p className="notice">
          A community map is not available. Ask the listing agent about the area.
        </p>
      )}
      <div className="location-actions">
        <Link className="button quiet" href={`/enquiry?listing=${encodeURIComponent(listing)}`}>
          Ask agent for exact location →
        </Link>
        {map && (
          <a
            href={`https://www.openstreetmap.org/#map=${map.view}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open community map <span className="sr-only">(opens in a new tab)</span> →
          </a>
        )}
      </div>
    </section>
  );
}

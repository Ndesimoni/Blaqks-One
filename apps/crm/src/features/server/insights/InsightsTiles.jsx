import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { StatTile } from '../dashboard/StatTile.jsx';
import { monthSources, viewingsToOffers } from './insightsKpis.js';

/**
 * The approved mockup's three insight tiles: the share of this month's new leads from the
 * website, this month's best source, and how many viewed clients reach an offer ("1 in 4").
 * Lead tiles need Clients; the offer tile also needs the schedule (Viewings).
 */
export function InsightsTiles({ data, month, leads, schedule }) {
  const { t } = useI18n();
  const { total, sources } = monthSources(data.Clients, month);
  const website = sources.find((row) => row.name === 'Website')?.count || 0;
  const best = sources[0];
  const offers = viewingsToOffers(data);
  const ratio = offers.offers
    ? t('insights.oneIn', { count: Math.max(1, Math.round(offers.viewed / offers.offers)) })
    : offers.viewed
      ? t('insights.noOffersYet')
      : '—';
  if (!leads) return null;
  return (
    <section className="kpi-tiles" aria-label={t('insights.figures')}>
      <StatTile
        label={t('insights.website')}
        value={total ? `${Math.round((website / total) * 100)}%` : '—'}
        note={total ? t('insights.websiteNote', { count: website, total }) : t('insights.noLeads')}
        route="Leads"
      />
      <StatTile
        label={t('insights.bestSource')}
        value={best ? best.name : '—'}
        note={best ? t('insights.bestSourceNote', { count: best.count }) : t('insights.noSource')}
        route="Leads"
      />
      {schedule && (
        <StatTile
          label={t('insights.toOffers')}
          value={ratio}
          note={
            offers.viewed
              ? t('insights.toOffersNote', { offers: offers.offers, viewed: offers.viewed })
              : t('insights.noViewed')
          }
          route="Viewings"
        />
      )}
    </section>
  );
}

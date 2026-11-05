import React from 'react';
import { Metric } from '../../../components/ui/Metric.jsx';
import { N } from '../../../lib/format.js';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Headline figures for the connected collections this member may open. */
export function ConnectedMetrics({ figures, widgets }) {
  const tiles = [
    widgets.leads && {
      name: 'ACTIVE LEADS',
      icon: 'users',
      value: figures.openLeads.length,
      sub: plural(figures.hot.length, 'high-priority lead'),
      accent: 'mint',
    },
    widgets.properties && {
      name: 'PROPERTIES',
      icon: 'building',
      value: figures.properties,
      sub: `${figures.available} available`,
      accent: 'sky',
    },
    widgets.schedule && {
      name: 'FOLLOW-UPS DUE',
      icon: 'bell',
      value: figures.dueTasks.length,
      sub: 'Today & overdue',
      accent: 'rose',
    },
    widgets.schedule && {
      name: 'UPCOMING VIEWINGS',
      icon: 'calendar',
      value: figures.upcoming.length,
      sub: 'From today onwards',
      accent: 'sand',
    },
  ].filter(Boolean);
  if (!tiles.length) return null;
  return (
    <div className="metrics-grid">
      {tiles.map((tile) => (
        <Metric key={tile.name} {...tile} value={N(tile.value)} />
      ))}
    </div>
  );
}

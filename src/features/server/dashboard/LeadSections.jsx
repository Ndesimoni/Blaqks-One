import React, { useMemo } from 'react';
import { PipelineBars } from '../../../components/charts/PipelineBars.jsx';
import { BarList } from '../../../components/charts/BarList.jsx';
import { N } from '../../../lib/format.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { DashSection, SectionEmpty, SectionLink } from './DashSection.jsx';
import { pipelineRows, sourceRows } from './sectionsModel.js';

/** Lead stages in pipeline order, with each stage's count and share of all leads. */
export function PipelineSection({ stages, className, style }) {
  const { navigate } = useNavigation();
  const rows = useMemo(() => pipelineRows(stages), [stages]);
  return (
    <DashSection
      className={className}
      style={style}
      label="Lead pipeline"
      caption="Where your clients stand today"
      action={<SectionLink onClick={() => navigate('Leads')}>Manage leads</SectionLink>}
    >
      {rows.length ? (
        <PipelineBars rows={rows} label="Leads by stage" />
      ) : (
        <SectionEmpty>No lead stages recorded.</SectionEmpty>
      )}
    </DashSection>
  );
}

/** Lead sources: ranked bars with leads, share and closed leads per source. */
export function LeadSourcesSection({ clients, className, style }) {
  const { navigate } = useNavigation();
  const rows = useMemo(() => sourceRows(clients), [clients]);
  return (
    <DashSection
      className={className}
      style={style}
      label="Lead sources"
      caption="The channels bringing clients in"
      action={<SectionLink onClick={() => navigate('Leads')}>Review sources</SectionLink>}
    >
      {rows.length ? (
        <BarList
          label="Leads by source"
          countClass="source-count"
          rows={rows.map((row) => ({
            name: row.name,
            value: row.count,
            count: N(row.count),
            detail: `${row.share}%`,
            note: row.closed ? `${N(row.closed)} closed` : '',
            tone: row.tone,
          }))}
        />
      ) : (
        <SectionEmpty>No lead sources recorded.</SectionEmpty>
      )}
    </DashSection>
  );
}

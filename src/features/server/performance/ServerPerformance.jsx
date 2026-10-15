import React, { useMemo, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { today } from '../../../lib/dates.js';
import { useDashboardWorkload } from '../dashboard/useDashboardWorkload.js';
import { useFinance } from '../finance/useFinance.js';
import { canManageTeam } from '../access.js';
import { PerformanceHeader } from './PerformanceHeader.jsx';
import { PerformanceGoals } from './PerformanceGoals.jsx';
import { PerformanceChart } from './PerformanceChart.jsx';
import { PerformanceHistory } from './PerformanceHistory.jsx';
import { usePerformanceTargets } from './usePerformanceTargets.js';
import { targetsFor } from './targetsModel.js';
import {
  financeCovers,
  monthsEnding,
  performanceRows,
  performanceSelection,
  visibleMetrics,
} from './performanceModel.js';
import './performance.css';

/**
 * Connected Performance: targets from the server, actuals derived only from the records and
 * finance this session can already see. Team-scope members may narrow the page to one person
 * with the Assigned-to filter; assigned-only members see their own work and targets.
 */
export function ServerPerformance({ owner }) {
  const { api, user } = useSession();
  const { scope } = useRecords();
  const workload = useDashboardWorkload();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const finance = useFinance(api, owner.id, user);
  const targets = usePerformanceTargets(api, owner.id, month);
  const { kind, memberId } = performanceSelection(scope, workload.filter, user.id);
  const selection = useMemo(() => ({ kind, memberId }), [kind, memberId]);
  const financeShown = financeCovers(finance.access, selection, user.id);
  const months = useMemo(() => monthsEnding(month), [month]);
  const rows = useMemo(
    () => performanceRows(workload.data, finance.overview, selection, months, financeShown),
    [workload.data, finance.overview, selection, months, financeShown],
  );
  const metrics = visibleMetrics(financeShown);
  const financeState = {
    loading: financeShown && !finance.overview && finance.loading,
    error: financeShown && !finance.overview ? finance.error : '',
    retry: finance.retry,
  };
  const forSelection = targetsFor(targets.targets, selection);
  const financeReady = financeShown && Boolean(finance.overview);
  // Staff never receive another member's targets, so say so instead of "No target set".
  const hidden = kind === 'member' && memberId !== user.id && !canManageTeam(user);
  return (
    <div className="page-stack connected-performance">
      <PerformanceHeader
        month={month}
        onMonth={setMonth}
        selection={selection}
        scope={scope}
        workload={workload}
      />
      <PerformanceGoals
        metrics={metrics}
        current={rows.at(-1)}
        targets={{ ...targets, forSelection }}
        selection={selection}
        finance={financeState}
        hidden={hidden}
        onSave={targets.save}
      />
      <PerformanceChart rows={rows} feesShown={financeReady} selection={selection} />
      <PerformanceHistory rows={rows} metrics={metrics} financeReady={financeReady} />
    </div>
  );
}

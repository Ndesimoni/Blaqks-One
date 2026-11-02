import { stageAndListingOptions } from '../../../config/fields/stageAndListingOptions.js';

/** Lead stages that take a client out of the pipeline rather than move it forward. */
const OFF_PATH = ['Lost', 'On hold'];

/** The Lead stage pipeline in order: New through Closed. */
export const leadStages = stageAndListingOptions['Lead stage'].filter(
  (stage) => !OFF_PATH.includes(stage),
);

/**
 * A read-only stage track over `stages` (the Lead stage pipeline unless given, e.g. a deal's).
 * Earlier stages are done, the saved one is current and later ones wait. A stage outside the
 * pipeline (Lost, On hold, a value imported from elsewhere) marks no step and is returned as
 * `offPath`. Matching ignores case and spaces.
 */
export function stageTrack(value, stages = leadStages) {
  const saved = String(value ?? '').trim();
  const at = saved ? stages.findIndex((stage) => stage.toLowerCase() === saved.toLowerCase()) : -1;
  return {
    stage: at >= 0 ? stages[at] : saved,
    position: at + 1,
    total: stages.length,
    offPath: at < 0 ? saved : '',
    steps: stages.map((label, index) => ({
      label,
      state: at < 0 || index > at ? 'todo' : index < at ? 'done' : 'current',
    })),
  };
}

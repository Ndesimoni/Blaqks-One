import { stageAndListingOptions } from '../../../config/fields/stageAndListingOptions.js';

/** Lead stages that take a client out of the pipeline rather than move it forward. */
const OFF_PATH = ['Lost', 'On hold'];

/** The Lead stage pipeline in order: New through Closed. */
export const leadStages = stageAndListingOptions['Lead stage'].filter(
  (stage) => !OFF_PATH.includes(stage),
);

/**
 * The read-only Lead stage track. Earlier stages are done, the saved one is current and later
 * ones wait. Lost, On hold or a value imported from elsewhere sits outside the pipeline: no
 * step is marked and the value is returned as `offPath`. Matching ignores case and spaces.
 */
export function stageTrack(value) {
  const saved = String(value ?? '').trim();
  const at = saved
    ? leadStages.findIndex((stage) => stage.toLowerCase() === saved.toLowerCase())
    : -1;
  return {
    stage: at >= 0 ? leadStages[at] : saved,
    position: at + 1,
    total: leadStages.length,
    offPath: at < 0 ? saved : '',
    steps: leadStages.map((label, index) => ({
      label,
      state: at < 0 || index > at ? 'todo' : index < at ? 'done' : 'current',
    })),
  };
}

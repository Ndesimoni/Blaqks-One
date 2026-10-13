// Plain-language record-action text for the review step and archived read-only views.
import {
  actionLabel,
  actionModules,
  deleteMainLabels,
  hasRecordedActions,
  normaliseActions,
  readActions,
} from './actionModel.js';

export const ARCHIVED_ACTIONS_TEXT = 'Action access not recorded (archived before action grants)';

/** Plain-language review lines for each enabled connected module. */
export function actionReview(form, moduleLabels) {
  const actions = normaliseActions(form.actions, form);
  return Object.keys(actionModules)
    .filter((module) => form.permissions[module])
    .map((module) => {
      const allowed = actionModules[module].filter((key) => actions[module][key]);
      return {
        module,
        label: moduleLabels[module] || module,
        text: allowed.length
          ? allowed.map((key) => actionLabel(module, key)).join(', ')
          : 'View only',
        sensitive: actions[module].deleteMain ? deleteMainLabels[module] : '',
      };
    });
}

/** Read-only summary for archived accounts; '{}' predates action grants. */
export function archivedActionText(member, moduleLabels) {
  if (member.roleId === 'admin') return 'Admin · Every record action';
  if (!hasRecordedActions(member.actions)) return ARCHIVED_ACTIONS_TEXT;
  const form = {
    permissions: member.permissions || {},
    recordScope: member.recordScope,
    actions: readActions(member.actions),
  };
  const lines = actionReview(form, moduleLabels);
  return lines.length
    ? lines.map((line) => `${line.label}: ${line.text}`).join('; ')
    : 'No connected sections';
}

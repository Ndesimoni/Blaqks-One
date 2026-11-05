// Plain-language record-action text for the form, the review step and archived read-only views.
import {
  actionBlocker,
  actionLabel,
  actionModules,
  hasRecordedActions,
  isSensitive,
  normaliseActions,
  readActions,
} from './actionModel.js';
import { clientDeleteNote, financeHelp, financeInvitationNote } from './financeActionModel.js';

export const ARCHIVED_ACTIONS_TEXT = 'Action access not recorded (archived before action grants)';
const deleteMainText = 'Sensitive: removes records for the whole team. Off by default.';

/** Help under a sensitive tick: why it is unavailable, or what it allows. */
export function actionHelp(module, key, form) {
  if (module === 'finance') return financeHelp(key, form);
  const blocker = actionBlocker(module, key, form);
  if (blocker) return blocker;
  const note = module === 'relationships' ? clientDeleteNote(form) : '';
  return note ? `${deleteMainText} ${note}` : deleteMainText;
}

/** Invitation guidance for the sensitive ticks a module hides, or ''. */
export function invitationNote(module) {
  if (module === 'finance') return financeInvitationNote;
  if (!actionModules[module].includes('deleteMain')) return '';
  const records = module === 'properties' ? 'properties' : 'clients and contacts';
  return `Deleting ${records} can be granted later, with whole-team visibility.`;
}

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
        sensitive: allowed
          .filter((key) => isSensitive(module, key))
          .map((key) => actionLabel(module, key))
          .join(', '),
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

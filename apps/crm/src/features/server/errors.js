import { DEAL_FIELD, isDealLinkMissing } from './dealLinks/dealLinkModel.js';

export function serverMutationFailure(error, editing) {
  const conflict = Boolean(
    editing && error.status === 409 && error.details?.code === 'version_conflict',
  );
  return {
    errors: error.details?.errors || {},
    message: conflict
      ? 'This record changed since you opened it. Your draft is still here. Reload the latest record before editing again.'
      : error.message,
    conflict,
  };
}

/** Record saves: a refused deal link (finance-design §17.3) also marks the deal field. */
export function serverSaveFailure(error, editing) {
  const failure = serverMutationFailure(error, editing);
  if (isDealLinkMissing(error)) failure.errors = { ...failure.errors, [DEAL_FIELD]: error.message };
  return failure;
}

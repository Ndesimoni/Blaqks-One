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

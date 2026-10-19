/**
 * Field guidance visibility (packet Q1). A pinned hint stays open until the member types
 * or closes it; automatic hints need the preference on, an untouched field and focus.
 */
export const hintVisible = ({ enabled, focused, pinned, typed }) =>
  Boolean(pinned || (enabled && focused && !typed));

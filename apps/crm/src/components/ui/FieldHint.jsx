import React, { useState } from 'react';
import { useGuidance } from '../../app/GuidanceContext.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { focusOpensHint, hintVisible } from '../../lib/fieldHint.js';
import { Icon } from './Icon.jsx';
import './field-hint.css';

const CONTROL = 'input,select,textarea';

/**
 * Field guidance (packet Q1). An untouched field shows its hint while focused when the
 * member has automatic hints on (a dropdown only on keyboard focus, so a mouse-opened list
 * is never disturbed); typing hides it, and the information button always
 * reopens it. Spread `scopeProps` on the field wrapper and pass `describedBy` to its
 * control so assistive technology announces the hint while it is shown.
 */
export function useFieldHint(id) {
  const { enabled } = useGuidance();
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [typed, setTyped] = useState(false);
  const shown = hintVisible({ enabled, focused, pinned, typed });
  return {
    hintId: `${id}-guidance`,
    shown,
    describedBy: shown ? `${id}-guidance` : '',
    toggle: () => setPinned((current) => !current),
    scopeProps: {
      onFocusCapture: (event) => {
        const control = event.target;
        if (control.matches?.(CONTROL) && focusOpensHint(control)) setFocused(true);
      },
      onBlurCapture: (event) => {
        if (event.target.matches?.(CONTROL)) setFocused(false);
      },
      // Bubble phase, after the control's onChange: a capture-phase state update re-renders
      // the controlled control before React reads it, which dropped the first keystroke.
      onInput: () => {
        setTyped(true);
        setPinned(false);
      },
    },
  };
}

export function FieldHintIcon({ state }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="field-hint-toggle"
      aria-expanded={state.shown}
      aria-controls={state.hintId}
      aria-label={t('common.guidance.toggle')}
      title={t('common.guidance.toggle')}
      onClick={state.toggle}
    >
      <Icon name="info" size={14} />
    </button>
  );
}

export function FieldHintText({ text, state }) {
  if (!text || !state.shown) return null;
  return (
    <small id={state.hintId} className="field-hint-note" role="note">
      {text}
    </small>
  );
}

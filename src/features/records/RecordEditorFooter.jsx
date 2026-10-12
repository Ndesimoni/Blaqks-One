import React from 'react';
import { Button } from '../../components/ui/Button.jsx';

export function RecordEditorFooter({ state, original }) {
  const { busy, saving, requestClose, multiStep, activeStep, selectStep, review } = state;
  return (
    <div className="drawer-footer">
      <Button variant="light" disabled={busy} onClick={requestClose}>
        Cancel
      </Button>
      <div className="form-step-actions">
        {multiStep && activeStep > 0 && (
          <Button variant="light" disabled={busy} onClick={() => selectStep(activeStep - 1)}>
            Back
          </Button>
        )}
        <Button icon={multiStep && !review ? 'arrow' : 'check'} type="submit" disabled={busy}>
          {saving
            ? 'Saving…'
            : multiStep && !review
              ? 'Next'
              : original
                ? 'Save changes'
                : 'Create record'}
        </Button>
      </div>
    </div>
  );
}

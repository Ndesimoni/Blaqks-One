import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';

/** Cancel on the left; Back, then on the last step Save and add another and the save. */
export function RecordEditorFooter({ state, original, another }) {
  const { t } = useI18n();
  const { busy, saving, requestClose, multiStep, activeStep, selectStep, review } = state;
  const last = !multiStep || review;
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
        {another && last && !original && (
          <Button variant="light" disabled={busy} onClick={state.submitAnother}>
            {t('recordPanel.saveAnother')}
          </Button>
        )}
        <Button icon={last ? 'check' : 'arrow'} type="submit" disabled={busy}>
          {saving ? 'Saving…' : !last ? 'Next' : original ? 'Save changes' : 'Create record'}
        </Button>
      </div>
    </div>
  );
}

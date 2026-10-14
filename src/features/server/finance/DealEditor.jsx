import React, { useId, useMemo } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { FormStepper } from '../../../components/ui/FormStepper.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { pad } from '../../../lib/dates.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { useDealEditor } from './useDealEditor.js';
import { dealSteps } from './dealDraft.js';
import { clientOptions, propertyOptions } from './dealOptions.js';
import { DealEditorFields } from './DealEditorFields.jsx';
import { DealEditorReview } from './DealEditorReview.jsx';
import { DealEstimatePanel } from './DealEstimatePanel.jsx';

/**
 * Add or edit a deal (finance-design §7) in the shared centred editor with the form
 * stepper. The live estimate is labelled as an estimate; the server fixes the figures when
 * the deal is earned. Money is typed as AED text and sent only as integer fils.
 */
export function DealEditor({ deal, onClose, onDone }) {
  const { actions, overview, user, access } = useFinanceContext();
  const { entries } = useRecords();
  const latest = deal ? overview.deals.find((row) => row.id === deal.id) : null;
  const state = useDealEditor({ deal, latest, actions, onDone, onClose });
  const titleId = useId();
  const stepTitleId = useId();
  const options = useMemo(
    () => ({
      clients: clientOptions(entries, user, access, deal?.clientId ?? ''),
      properties: propertyOptions(entries, deal?.propertyId ?? ''),
    }),
    [entries, user, access, deal],
  );
  const { step, review, busy } = state;
  return (
    <Drawer
      className="editor-drawer wizard-editor finance-editor"
      titleId={titleId}
      onClose={state.requestClose}
    >
      <div className="drawer-top">
        <div>
          <div className="eyebrow">DEALS · {deal ? 'EDIT DEAL' : 'NEW DEAL'}</div>
          <h2 id={titleId}>{deal ? `Edit ${deal.dealId}` : 'New deal'}</h2>
          <p>
            {deal
              ? 'Update the deal terms, then review and save.'
              : 'The deal ID is issued when you save.'}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close deal editor"
          disabled={busy}
          onClick={state.requestClose}
        >
          <Icon name="close" size={21} />
        </button>
      </div>
      <form
        noValidate
        className="drawer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) state.submit();
        }}
      >
        <FormStepper
          steps={dealSteps}
          activeStep={step}
          accessibleStep={state.reached}
          disabled={busy}
          onSelect={state.select}
        />
        <div className="drawer-body" ref={state.bodyRef}>
          {Object.values(state.errors).some(Boolean) && (
            <p className="field-error" role="alert">
              Please correct the highlighted fields.
            </p>
          )}
          {state.message && (
            <div className="finance-alert" role="alert">
              <Icon name="info" size={18} />
              <p>{state.message}</p>
            </div>
          )}
          {state.conflict && latest && (
            <Button variant="light" disabled={busy} onClick={state.reload}>
              Reload latest deal
            </Button>
          )}
          <h3
            id={stepTitleId}
            className="form-heading form-step-title"
            tabIndex={-1}
            ref={state.headingRef}
          >
            <span>{pad(step + 1)}</span>
            {dealSteps[step].title}
          </h3>
          <fieldset disabled={busy} className="finance-fieldset">
            {review ? (
              <DealEditorReview form={state.form} options={options} onEdit={state.select} />
            ) : (
              <DealEditorFields
                stepId={dealSteps[step].id}
                state={state}
                options={options}
                labelledBy={stepTitleId}
              />
            )}
          </fieldset>
          {step > 0 && <DealEstimatePanel form={state.form} deal={latest ?? deal} />}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={state.requestClose}>
            Cancel
          </Button>
          <div className="form-step-actions">
            {step > 0 && (
              <Button variant="light" disabled={busy} onClick={state.back}>
                Back
              </Button>
            )}
            <Button type="submit" icon={review ? 'check' : 'arrow'} disabled={busy}>
              {busy ? 'Saving…' : !review ? 'Next' : deal ? 'Save changes' : 'Create deal'}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

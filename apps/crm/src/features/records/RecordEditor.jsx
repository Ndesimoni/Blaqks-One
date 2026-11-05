import React, { useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { FormStepper } from '../../components/ui/FormStepper.jsx';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { useRecordEditor } from './useRecordEditor.js';
import { RecordEditorHeader } from './RecordEditorHeader.jsx';
import { RecordEditorBody } from './RecordEditorBody.jsx';
import { RecordEditorFooter } from './RecordEditorFooter.jsx';

/** A lead from Create starts as a client at stage New (createModel). */
const isNewLead = (drawer) => drawer.record?.lead_stage === 'New';

/**
 * The create and edit form as the approved mockup's form slider from the right edge. `onAnother`
 * (connected) offers Save and add another, which opens a fresh form after a save. `idPolicy`
 * is connected-only: `issued` lets the server issue a blank ID; `readOnly` locks it.
 */
export function RecordEditor({
  drawer,
  data,
  onClose,
  onSave,
  onReload,
  onAnother,
  storageMode = 'browser',
  idPolicy,
}) {
  const { module, original } = drawer;
  const { route } = useNavigation();
  const titleId = useId();
  const stepTitleId = useId();
  const state = useRecordEditor({
    drawer,
    data,
    onClose,
    onSave,
    onReload,
    onAnother,
    idOptional: Boolean(idPolicy?.issued),
  });
  const { multiStep, steps, activeStep, accessibleStep, selectStep, busy } = state;
  return (
    <Drawer
      className={'editor-drawer form-slider' + (multiStep ? ' wizard-editor' : '')}
      placement="right"
      titleId={titleId}
      onClose={state.requestClose}
    >
      <RecordEditorHeader
        module={module}
        original={original}
        lead={module === 'Clients' && (route === 'Leads' || (!original && isNewLead(drawer)))}
        form={state.form}
        idField={state.sections[0].fields[0]}
        titleId={titleId}
        busy={busy}
        requestClose={state.requestClose}
      />
      <form noValidate onSubmit={state.submit} className="drawer-form">
        {multiStep && (
          <FormStepper
            steps={steps}
            activeStep={activeStep}
            accessibleStep={accessibleStep}
            disabled={busy}
            onSelect={selectStep}
          />
        )}
        <RecordEditorBody
          module={module}
          data={data}
          stepTitleId={stepTitleId}
          onReload={onReload}
          storageMode={storageMode}
          idPolicy={idPolicy}
          state={state}
        />
        <RecordEditorFooter state={state} original={original} another={Boolean(onAnother)} />
      </form>
    </Drawer>
  );
}

import React, { useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { FormStepper } from '../../components/ui/FormStepper.jsx';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { useRecordEditor } from './useRecordEditor.js';
import { RecordEditorHeader } from './RecordEditorHeader.jsx';
import { RecordEditorBody } from './RecordEditorBody.jsx';
import { RecordEditorFooter } from './RecordEditorFooter.jsx';

export function RecordEditor({ drawer, data, onClose, onSave, onReload, storageMode = 'browser' }) {
  const { module, original } = drawer;
  const { route } = useNavigation();
  const titleId = useId();
  const stepTitleId = useId();
  const state = useRecordEditor({ drawer, data, onClose, onSave, onReload });
  const { multiStep, steps, activeStep, accessibleStep, selectStep, busy } = state;
  return (
    <Drawer
      className={'editor-drawer' + (multiStep ? ' wizard-editor' : '')}
      size={module === 'Properties' ? 'wide' : 'standard'}
      titleId={titleId}
      onClose={state.requestClose}
    >
      <RecordEditorHeader
        module={module}
        original={original}
        lead={module === 'Clients' && route === 'Leads'}
        form={state.form}
        idField={state.sections[0].fields[0]}
        multiStep={multiStep}
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
          state={state}
        />
        <RecordEditorFooter state={state} original={original} />
      </form>
    </Drawer>
  );
}

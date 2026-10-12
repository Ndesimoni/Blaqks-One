import React, { useEffect, useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { FormStepper } from '../../components/ui/FormStepper.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useSession } from '../../hooks/useSession.js';
import { useImportDraft } from './useImportDraft.js';
import { useImportFlow } from './useImportFlow.js';
import { ImportSourceFields } from './ImportSourceFields.jsx';
import { ImportReview } from './ImportReview.jsx';
import './import.css';

const steps = [
  { id: 'source', title: 'Choose records & workspace' },
  { id: 'review', title: 'Review & import' },
];

export function ImportDialog({ workspaces, onClose, onImported }) {
  const { user, api } = useSession();
  const titleId = useId();
  const draft = useImportDraft(user);
  const flow = useImportFlow(api, draft);
  const busy = flow.busy || draft.reading;
  useUnsavedChanges(Boolean(draft.source) && !flow.result, busy);
  useEffect(() => {
    if (flow.result) onImported(flow.result);
  }, [flow.result, onImported]);
  const close = () => {
    if (busy) return;
    if (
      draft.source &&
      !flow.result &&
      !confirm(
        'Close this import? If a commit response was lost, retry first to confirm the result. Your source records stay intact.',
      )
    )
      return;
    onClose();
  };
  return (
    <Drawer titleId={titleId} className="editor-drawer wizard-editor" onClose={close}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">SUPER ADMIN · DATA MIGRATION</div>
          <h2 id={titleId} data-initial-focus tabIndex={-1}>
            Import saved CRM records
          </h2>
          <p>Move clients, contacts and properties to their server workspace.</p>
        </div>
        <button className="icon-btn" aria-label="Close import" disabled={busy} onClick={close}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <FormStepper
        steps={steps}
        activeStep={flow.preview ? 1 : 0}
        accessibleStep={flow.preview ? 1 : 0}
        disabled={busy}
        onSelect={(index) => {
          if (index === 0) flow.clearPreview();
        }}
      />
      <div className="drawer-body">
        {flow.error && (
          <p className="field-error" role="alert">
            {flow.error}
          </p>
        )}
        {flow.preview ? (
          <ImportReview
            preview={flow.preview}
            draft={draft}
            targetName={
              workspaces.find((workspace) => workspace.id === flow.preview.targetId)?.name ||
              flow.preview.targetId
            }
          />
        ) : (
          <ImportSourceFields draft={draft} workspaces={workspaces} busy={busy} />
        )}
      </div>
      <div className="drawer-footer">
        <Button variant="light" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <div className="form-step-actions">
          {flow.preview && (
            <Button variant="light" disabled={busy} onClick={flow.clearPreview}>
              Back
            </Button>
          )}
          <Button
            icon={flow.preview ? 'check' : 'arrow'}
            disabled={busy || !draft.source || !draft.targetId}
            onClick={flow.preview ? flow.commit : flow.prepare}
          >
            {busy
              ? flow.preview
                ? 'Importing…'
                : 'Preparing…'
              : flow.preview
                ? 'Import records'
                : 'Preview import'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

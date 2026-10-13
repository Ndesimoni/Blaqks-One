import React from 'react';
import { PropertyMediaEditor } from '../properties/PropertyMediaEditor.jsx';
import { RecordField } from './RecordField.jsx';
import { RecordReview } from './RecordReview.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { pad } from '../../lib/dates.js';

export function RecordEditorBody({
  module,
  data,
  stepTitleId,
  onReload,
  storageMode,
  idPolicy,
  state,
}) {
  const {
    form,
    setForm,
    uploading,
    setUploading,
    saveError,
    conflict,
    reload,
    busy,
    errors,
    bodyRef,
    headingRef,
    activeStep,
    steps,
    review,
    sections,
    selectStep,
    change,
  } = state;
  const idField = sections[0].fields[0];
  const currentSection = sections[activeStep];
  // A locked ID ("Issued when saved") is read-only, so focus starts on the first editable field.
  const idLocked = Boolean(idPolicy?.readOnly);
  const focusCandidate = (field) =>
    field.key === idField.key ? !idLocked : idLocked && currentSection === sections[0];
  return (
    <div className="drawer-body" ref={bodyRef}>
      {Object.values(errors).some(Boolean) && (
        <p className="field-error" role="alert">
          Please correct the highlighted fields before saving.
        </p>
      )}
      {conflict && onReload && (
        <Button variant="light" disabled={busy} onClick={reload}>
          Reload latest record
        </Button>
      )}
      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}
      <h3 id={stepTitleId} className="form-heading form-step-title" tabIndex={-1} ref={headingRef}>
        <span>{pad(activeStep + 1)}</span>
        {steps[activeStep].title}
      </h3>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {review ? (
          <RecordReview
            module={module}
            form={form}
            data={data}
            sections={sections}
            onEdit={selectStep}
          />
        ) : (
          <>
            <div className="form-intro">
              <Icon name="info" size={17} />
              <span>
                Fields marked * are required. Related records should be created first for correct
                linking.
              </span>
            </div>
            {currentSection.media && (
              <PropertyMediaEditor
                form={form}
                setForm={setForm}
                uploading={uploading}
                setUploading={setUploading}
                storageMode={storageMode}
              />
            )}
            {currentSection.id === 'schedule' && (
              <p className="form-intro">
                Times use Dubai time (UTC+4). Schedule details are saved with this CRM record. Leave
                the start time blank for a date-only follow-up.
              </p>
            )}
            <section className="form-section" aria-labelledby={stepTitleId}>
              <div className="form-grid">
                {currentSection.fields.map((field) => (
                  <RecordField
                    key={field.key}
                    field={field}
                    module={module}
                    data={data}
                    idField={idField}
                    idPolicy={idPolicy}
                    initialFocus={focusCandidate(field)}
                    value={form[field.key]}
                    error={errors[field.key]}
                    change={change}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </fieldset>
    </div>
  );
}

import React from 'react';
import { AgreementDetail } from '../agreements/AgreementDetail.jsx';
import { AgreementForm } from '../agreements/AgreementForm.jsx';
import '../agreements/agreements.css';
import '../agreements/agreement-detail.css';
import '../agreements/agreement-terms.css';
import '../agreements/agreement-form.css';
import '../agreements/agreement-lifecycle.css';

/**
 * Co-broking from a listing share (docs/record-sharing.md R2), opened over the share: the
 * agreement form with the listing's facts fixed, then the agreement itself, where the draft
 * is reviewed and sent. Editing the draft or answering an offer reuses the same form, and
 * closing returns to the share. `view` is `{ form: { mode, detail } }` or `{ id }`.
 */
export function ShareCoBroking({ view, onView, onClose }) {
  if (view.form) {
    const { mode, detail } = view.form;
    const back = () => (mode === 'share' ? onClose() : onView({ id: detail.agreement.id }));
    return (
      <AgreementForm mode={mode} detail={detail} onClose={back} onSaved={(id) => onView({ id })} />
    );
  }
  return (
    <AgreementDetail
      id={view.id}
      onClose={onClose}
      onChanged={() => {}}
      onEdit={(mode, detail) => onView({ form: { mode, detail } })}
    />
  );
}

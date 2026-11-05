import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { FormSliderHead } from '../../../components/ui/FormSliderHead.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { HELP_CATEGORIES, blankRequest, requestProblem } from './helpModel.js';

/** Ask for help: what it is about, a subject and the message, in the form slider. */
export function HelpRequestForm({ onSend, onClose }) {
  const { t } = useI18n();
  const k = (key) => t(`help.${key}`);
  const titleId = useId();
  const [form, setForm] = useState(blankRequest);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    const problem = requestProblem(form);
    if (problem) return setError(t(problem));
    setBusy(true);
    setError('');
    const failure = await onSend({
      category: form.category,
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
    setBusy(false);
    if (failure) setError(failure);
  };
  return (
    <Drawer
      placement="right"
      className="editor-drawer form-slider"
      titleId={titleId}
      onClose={() => !busy && onClose()}
    >
      <FormSliderHead
        titleId={titleId}
        title={k('newTitle')}
        closeLabel={k('cancel')}
        busy={busy}
        onClose={onClose}
      />
      <form noValidate className="drawer-form" onSubmit={submit}>
        <div className="drawer-body">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-card">
            <div className="field">
              <label htmlFor="help-category">{k('category')}</label>
              <select
                id="help-category"
                value={form.category}
                disabled={busy}
                onChange={set('category')}
              >
                {HELP_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {k(`category.${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="help-subject">{k('subject')}</label>
              <input
                id="help-subject"
                value={form.subject}
                maxLength={160}
                disabled={busy}
                onChange={set('subject')}
              />
            </div>
            <div className="field">
              <label htmlFor="help-message">{k('message')}</label>
              <textarea
                id="help-message"
                rows={6}
                value={form.message}
                maxLength={4000}
                disabled={busy}
                onChange={set('message')}
              />
              <small>{k('messageHint')}</small>
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={onClose}>
            {k('cancel')}
          </Button>
          <Button type="submit" icon="arrow" disabled={busy}>
            {busy ? k('sending') : k('send')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

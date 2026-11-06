import React, { useRef, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { TemplateFields, TemplatePreview } from './TemplatePreview.jsx';
import { variableProblem } from './whatsappModel.js';

/**
 * Choose an approved template, see what the client receives and fill in its values (W1b,
 * design §5): each value is checked before sending, the first refused one takes focus, and
 * the server checks them again. `onSend({id, variables})` resolves to '' or the reason.
 * A refusal keeps every value typed.
 */
export function TemplateForm({ id, templates, failedKey, onSend }) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState(templates[0]?.id ?? '');
  const [values, setValues] = useState([]);
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = useRef([]);
  // A poll may take a template away once it is no longer approved; the first one then shows.
  const template = templates.find((item) => item.id === chosen) ?? templates[0];
  const count = template?.variables ?? 0;
  const choose = (next) => {
    setChosen(next);
    setValues([]);
    setProblems([]);
    setError('');
  };
  const change = (index, value) => {
    setValues((current) => Object.assign([...current], { [index]: value }));
    setProblems((current) => Object.assign([...current], { [index]: '' }));
  };
  const send = async (event) => {
    event.preventDefault();
    if (busy || !template) return;
    const list = Array.from({ length: count }, (_, index) => String(values[index] ?? ''));
    const found = list.map(variableProblem);
    setProblems(found);
    const first = found.findIndex(Boolean);
    if (first >= 0) {
      fields.current[first]?.focus();
      return;
    }
    setBusy(true);
    const failure = await onSend({ id: template.id, variables: list.map((v) => v.trim()) });
    setBusy(false);
    if (failure) setError(t(failedKey, { reason: failure }));
    else choose(template.id);
  };
  if (!template) return null;
  return (
    <form className="wa-template" aria-label={t('whatsappSend.template.form')} onSubmit={send}>
      <TemplatePreview id={id} body={template.body} values={values} />
      <div className="wa-fields">
        <div className="wa-field field">
          <label htmlFor={`${id}-template`}>{t('whatsappSend.template.label')}</label>
          <select
            id={`${id}-template`}
            value={template.id}
            disabled={busy}
            onChange={(event) => choose(event.target.value)}
          >
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <TemplateFields
          id={id}
          count={count}
          values={values}
          problems={problems}
          fields={fields}
          onChange={change}
        />
      </div>
      <div className="wa-template-foot">
        <small id={`${id}-rules`}>{count > 0 ? t('whatsappSend.template.rules') : ''}</small>
        <Button type="submit" icon="arrow" disabled={busy}>
          {busy ? t('whatsappSend.template.sending') : t('whatsappSend.template.send')}
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

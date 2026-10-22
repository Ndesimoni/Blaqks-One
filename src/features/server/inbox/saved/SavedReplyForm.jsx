import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FillInChips } from './FillInChips.jsx';

/**
 * Add or edit a saved reply (designer spec §3). The Admin chooses who can use a new reply;
 * members' replies are their own. The submit stops here, so it never sends the message the
 * dialog was opened from. `cancelRef` lets the dialog's close and Escape ask first too.
 */
export function SavedReplyForm({ saved, editing, admin, onDone, cancelRef }) {
  const { t } = useI18n();
  const id = useId();
  const titleRef = useRef(null);
  const textRef = useRef(null);
  const original = editing.item ?? { title: '', body: '' };
  const [title, setTitle] = useState(original.title);
  const [body, setBody] = useState(original.body);
  const [scope, setScope] = useState(editing.scope);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [reloaded, setReloaded] = useState(false);
  const [asking, setAsking] = useState(false);
  const latest = saved.data?.[editing.scope]?.find((item) => item.id === editing.item?.id);
  const base = reloaded ? latest : editing.item;
  const dirty = title !== original.title || body !== original.body;
  cancelRef.current = () => (dirty ? setAsking(true) : onDone(null));
  const submit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const found = {
      title: title.trim() ? '' : t('inboxSaved.form.needTitle'),
      body: body.trim() ? '' : t('inboxSaved.form.needText'),
    };
    setErrors(found);
    if (found.title || found.body) return (found.title ? titleRef : textRef).current?.focus();
    setBusy(true);
    const failure = editing.item
      ? await saved.edit(base ?? editing.item, title.trim(), body.trim())
      : await saved.add(scope, title.trim(), body.trim());
    setBusy(false);
    if (!failure) return onDone(editing.item ? null : scope);
    const stale = failure.details?.code === 'version_conflict';
    setProblem({ message: stale ? t('inboxSaved.form.changed') : failure.message, stale });
  };
  const field = (name) => `${id}-${name}`;
  return (
    <form className="saved-form" onSubmit={submit} noValidate>
      <label htmlFor={field('title')}>{t('inboxSaved.form.title')}</label>
      <input
        id={field('title')}
        ref={titleRef}
        data-initial-focus
        maxLength={80}
        value={title}
        aria-invalid={Boolean(errors.title)}
        aria-describedby={errors.title ? field('title-error') : undefined}
        onChange={(event) => setTitle(event.target.value)}
      />
      {title.length >= 60 && <small className="saved-form-count">{title.length} / 80</small>}
      {errors.title && (
        <p id={field('title-error')} className="field-error">
          {errors.title}
        </p>
      )}
      <label htmlFor={field('text')}>{t('inboxSaved.form.text')}</label>
      <FillInChips textRef={textRef} body={body} setBody={setBody} hintId={field('hint')} />
      <textarea
        id={field('text')}
        ref={textRef}
        className="saved-form-text"
        maxLength={5000}
        value={body}
        aria-invalid={Boolean(errors.body)}
        aria-describedby={field('hint')}
        onChange={(event) => setBody(event.target.value)}
      />
      <small className="saved-form-count">{body.length} / 5,000</small>
      {errors.body && <p className="field-error">{errors.body}</p>}
      {admin && !editing.item ? (
        <fieldset className="saved-form-scope">
          <legend>{t('inboxSaved.form.who')}</legend>
          {['company', 'mine'].map((name) => (
            <label key={name}>
              <input
                type="radio"
                name={field('scope')}
                checked={scope === name}
                onChange={() => setScope(name)}
              />
              {t(name === 'company' ? 'inboxSaved.form.everyone' : 'inboxSaved.form.onlyMe')}
            </label>
          ))}
        </fieldset>
      ) : (
        <small className="saved-form-shared">
          {t(scope === 'company' ? 'inboxSaved.form.sharedWith' : 'inboxSaved.form.private')}
        </small>
      )}
      {problem && (
        <div className="field-error saved-form-problem" role="alert">
          <span>{problem.message}</span>
          {problem.stale && (
            <Button
              variant="light"
              onClick={async () => {
                await saved.load();
                setReloaded(true);
                setProblem(null);
              }}
            >
              {t('inboxSaved.form.reload')}
            </Button>
          )}
        </div>
      )}
      {asking ? (
        <div className="saved-manager-confirm" role="alert">
          <span>{t('inboxSaved.form.discard')}</span>
          <div>
            <Button variant="light" autoFocus onClick={() => setAsking(false)}>
              {t('inboxSaved.form.keepEditing')}
            </Button>
            <Button variant="danger-light" onClick={() => onDone(null)}>
              {t('inboxSaved.form.discardYes')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="saved-form-actions">
          <Button variant="light" onClick={() => cancelRef.current()}>
            {t('inboxSaved.form.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t('inboxSaved.form.saving') : t('inboxSaved.form.save')}
          </Button>
        </div>
      )}
    </form>
  );
}

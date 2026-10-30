import { useEffect, useRef, useState } from 'react';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { readSettings } from '../server/finance/settingsModel.js';
import {
  settingsBody,
  settingsDirty,
  settingsDraft,
  settingsErrors,
} from './financeSettingsForm.js';

const idle = { text: '', conflict: false };

/**
 * Draft, validation and save for the team finance settings (finance-design §7, §14.3). The
 * draft is kept on every refusal; a version conflict offers to load the latest settings.
 * `settings` is the overview's team settings (null before setup); `actions` is
 * `useFinanceActions`, which refuses non-Admins locally with the server's message.
 */
export function useFinanceSettingsForm(settings, actions) {
  const [base, setBase] = useState(settings);
  const [draft, setDraft] = useState(() => settingsDraft(settings));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(idle);
  const [saved, setSaved] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef(null);
  const dirty = settingsDirty(draft, base);
  useUnsavedChanges(dirty, actions.busy, 'Discard your unsaved finance settings?');
  // Adopt refreshed settings only while the Admin has nothing unsaved.
  useEffect(() => {
    if (!dirty && settings !== base) {
      setBase(settings);
      setDraft(settingsDraft(settings));
    }
  }, [settings, base, dirty]);
  useEffect(() => {
    if (focusRequest) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setSaved('');
  };
  const loadLatest = () => {
    setBase(settings);
    setDraft(settingsDraft(settings));
    setErrors({});
    setFailure(idle);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (actions.busy) return;
    const found = settingsErrors(draft);
    setErrors(found);
    setSaved('');
    if (Object.keys(found).length) {
      setFailure(idle);
      setFocusRequest((value) => value + 1);
      return;
    }
    const result = await actions.saveSettings(settingsBody(draft, base));
    if (!result.ok) {
      const conflict = result.status === 409;
      setErrors(result.errors || {});
      setFailure({
        text: conflict ? `${result.message} Your changes are still here.` : result.message,
        conflict,
      });
      return;
    }
    let next;
    try {
      next = readSettings(result.result.settings, true);
    } catch (error) {
      setFailure({ text: error.message, conflict: false });
      return;
    }
    setBase(next);
    setDraft(settingsDraft(next));
    setFailure(idle);
    setSaved('Finance settings saved.');
  };
  return { base, draft, errors, failure, saved, dirty, formRef, change, loadLatest, submit };
}

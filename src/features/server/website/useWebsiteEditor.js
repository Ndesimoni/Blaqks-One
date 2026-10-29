import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { websiteApi, websiteForm, websitePayload } from './websiteModel.js';

export function useWebsiteEditor(api, workspace, platform, t) {
  const transport = useMemo(() => websiteApi(api, workspace, platform), [api, workspace, platform]);
  const [state, setState] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);
  const dirty = Boolean(form && state && JSON.stringify(form) !== JSON.stringify(state.baseline));
  const needsRecovery = Boolean(form && state && form.version !== (state.site?.version ?? 0));
  useUnsavedChanges(dirty, busy, t('websites.discardChanges'));
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setNotice('');
    Promise.all([transport.read(controller.signal), transport.readDraft(controller.signal)])
      .then(([live, drafts]) => {
        if (controller.signal.aborted) return;
        if (
          !Object.hasOwn(live, 'site') ||
          !Number.isSafeInteger(drafts.version) ||
          drafts.version < 0
        )
          throw Error(t('websites.loadError'));
        const baseline = websiteForm(live.site, platform, drafts.draft?.site);
        setState({ site: live.site, version: drafts.version, draft: drafts.draft, baseline });
        setForm(baseline);
        setConflict(false);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [transport, attempt, platform, t]);
  const reload = useCallback(() => {
    if (running.current || (dirty && !window.confirm(t('websites.discardChanges')))) return;
    setState(null);
    setForm(null);
    setAttempt((value) => value + 1);
  }, [dirty, t]);
  const change = (key, value, group) => {
    setForm((current) =>
      group
        ? { ...current, [group]: { ...current[group], [key]: value } }
        : { ...current, [key]: value },
    );
    setNotice('');
  };
  const recover = () => {
    if (running.current || conflict || !state?.site || !window.confirm(t('websites.replaceDraft')))
      return;
    setForm(websiteForm(state.site, platform));
    setNotice(t('websites.publishedLoaded'));
    setError('');
  };
  const run = async (intent) => {
    if (running.current || conflict || !state || !form || (intent === 'publish' && needsRecovery))
      return;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let draft = state.draft;
      if (dirty || !draft) {
        const saved = await transport.save({
          version: state.version,
          site: websitePayload(form, platform),
        });
        draft = saved.draft;
        const baseline = websiteForm(state.site, platform, draft.site);
        setState({ ...state, version: draft.version, draft, baseline });
        setForm(baseline);
      }
      if (intent === 'publish') {
        const published = await transport.publish(draft.version);
        const baseline = websiteForm(published.site, platform);
        setState({ site: published.site, version: draft.version + 1, draft: null, baseline });
        setForm(baseline);
        setNotice(t('websites.publishedNotice'));
      } else setNotice(t('websites.draftSavedNotice'));
    } catch (failure) {
      const stale = failure.status === 409 && failure.details?.code === 'version_conflict';
      setConflict(stale);
      setError(stale ? t('websites.conflict') : failure.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return {
    state,
    form,
    dirty,
    busy,
    error,
    notice,
    conflict,
    needsRecovery,
    change,
    run,
    reload,
    recover,
  };
}

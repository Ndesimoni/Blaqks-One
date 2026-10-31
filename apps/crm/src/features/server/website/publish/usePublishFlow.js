import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../../../hooks/useSession.js';
import { useRecords } from '../../../../hooks/useWorkspace.js';
import {
  defaultAgent,
  detailErrors,
  existingFor,
  initialMedia,
  isReady,
  photoChoices,
  planChoices,
  publishBody,
  publishError,
} from './publishModel.js';

export const PUBLISH_STEPS = ['property', 'agent', 'media', 'details', 'review'];

const fresh = (entry) => ({
  recordId: entry?.id || '',
  ...initialMedia(entry?.record),
  permit: String(entry?.record?.permit_reference || ''),
});

/**
 * The publish stepper. From the Properties tab the first step chooses the property; from a
 * property's panel (`entry`) it is fixed and readiness is checked on the agent step. Each
 * step validates before advancing, entries survive Back and failures, and a stale version
 * refreshes the records and publications so the next attempt uses the latest ones.
 */
export function usePublishFlow({ entry: fixed, publication, publications, publishers, done }) {
  const { api, user } = useSession();
  const records = useRecords();
  const steps = fixed ? PUBLISH_STEPS.slice(1) : PUBLISH_STEPS;
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [draft, setDraft] = useState(() => ({
    ...fresh(fixed),
    agentProfileId: publication?.agentProfileId || '',
    destination: publication?.destination || 'general_and_company',
    market: '',
  }));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const headingRef = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = true;
  }, [step]);
  const entry =
    (records.entries?.Properties || []).find((item) => item.id === draft.recordId) ||
    (fixed?.id === draft.recordId ? fixed : null);
  const { eligible } = publishers;
  const agentProfileId = eligible.some((profile) => profile.id === draft.agentProfileId)
    ? draft.agentProfileId
    : defaultAgent(eligible, entry?.assignee, user.id);
  // Only files still in the saved gallery (it can change through Edit property or a reload).
  const files = (list) => new Set(list(entry?.record).map((asset) => asset.file));
  const [photos, plans] = [files(photoChoices), files(planChoices)];
  const current = {
    ...draft,
    agentProfileId,
    photos: draft.photos.filter((file) => photos.has(file)),
    floorPlans: draft.floorPlans.filter((file) => plans.has(file)),
  };
  const existing = existingFor(publications, draft.recordId, agentProfileId);
  const stepId = steps[step];
  const change = (changes) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setErrors({});
  };
  const choose = (next) => {
    setDraft((previous) => ({ ...previous, ...fresh(next) }));
    setErrors({});
    setReached(0);
  };
  const check = () => {
    if (!entry) return { property: 'chooseProperty' };
    const property = stepId === 'property' || (fixed && stepId === 'agent');
    if (property && !isReady(entry.record)) return { property: 'notReady' };
    if (stepId === 'agent' && !agentProfileId) return { agent: 'chooseAgent' };
    if (stepId === 'media' && !current.photos.length) return { photos: 'photosRequired' };
    if (stepId === 'details') return detailErrors(draft);
    return {};
  };
  const focusInvalid = () =>
    requestAnimationFrame(() =>
      bodyRef.current?.querySelector('[aria-invalid="true"]:not(:disabled)')?.focus(),
    );
  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const body = publishBody({ entry, draft: current, existing });
      const result = await api.publishPropertyWebsite(user.workspaceId || user.id, body);
      done.published(result?.publication);
    } catch (error) {
      const mapped = publishError(error);
      setFailure(mapped);
      if (mapped.stale) await Promise.allSettled([records.refresh?.(), done.stale?.()]);
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return focusInvalid();
    if (stepId === 'review') return submit();
    setFailure(null);
    setStep(step + 1);
    setReached((previous) => Math.max(previous, step + 1));
  };
  return {
    steps,
    step,
    stepId,
    reached,
    select: (index) => {
      if (!busy && index <= reached) setStep(index);
    },
    back: () => setStep((previous) => Math.max(0, previous - 1)),
    next,
    draft: current,
    change,
    choose,
    entry,
    existing,
    fixed: Boolean(fixed),
    errors,
    failure,
    busy,
    bodyRef,
    headingRef,
  };
}

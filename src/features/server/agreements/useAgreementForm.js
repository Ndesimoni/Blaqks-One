import { useEffect, useRef, useState } from 'react';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { draftFromTerms, emptyDraft, shareDraft } from './agreementDraft.js';
import { readDraft, stepErrors } from './readDraft.js';
import { failureNotice } from './useAgreement.js';

const STEPS = {
  create: ['parties', 'subject', 'money', 'review'],
  revise: ['subject', 'money', 'review'],
  counter: ['subject', 'money', 'review'],
  amend: ['subject', 'money', 'review'],
  share: ['subject', 'money', 'review'],
};

const firstDraft = (mode, detail) => {
  if (mode === 'create') return emptyDraft();
  if (mode === 'share')
    return {
      ...shareDraft(detail.share),
      ...(detail.marketplaceRequestId
        ? { clientName: 'Marketplace client', shareContact: false, contact: '' }
        : {}),
    };
  return draftFromTerms(detail.agreement.kind, detail.revision.terms);
};

/** The request that freezes the reviewed terms into a new revision; resolves to its ID. */
async function save(api, workspaceId, { mode, detail, draft, recipient, terms }) {
  if (mode === 'create') {
    const { agreement } = await api.createDealAgreement(workspaceId, {
      kind: draft.kind,
      recipient: { workspaceId: recipient.workspaceId, memberId: recipient.memberId },
      terms,
    });
    return agreement.id;
  }
  if (mode === 'share') {
    const { agreement } = detail.marketplaceRequestId
      ? await api.proposeMarketplaceAgreement(workspaceId, detail.marketplaceRequestId, terms)
      : await api.proposeCoBroking(workspaceId, detail.share.id, terms);
    return agreement.id;
  }
  const { id, version } = detail.agreement;
  const command = {
    revise: api.reviseAgreement,
    counter: api.counterAgreement,
    amend: api.amendAgreement,
  }[mode];
  await command(workspaceId, id, version, terms);
  return id;
}

/**
 * Stepped agreement form state: the draft, the found recipient, which steps were reached,
 * per-step validation that focuses the first invalid control, unsaved-change protection
 * and the save. Refusals keep every entry.
 */
export function useAgreementForm({ api, workspaceId, mode, detail, onSaved, discardMessage }) {
  const [initial] = useState(() => firstDraft(mode, detail));
  const [draft, setDraft] = useState(initial);
  const [recipient, setRecipient] = useState(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [checked, setChecked] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef(null);
  const steps = STEPS[mode];
  const name = steps[step];
  const read = readDraft(draft);
  const dirty = Boolean(recipient) || JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedChanges(dirty, saving, discardMessage);
  useEffect(() => {
    if (focusRequest) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const errorsOf = (stepName) =>
    stepName === 'parties'
      ? recipient
        ? {}
        : { recipient: { error: 'recipient' } }
      : stepErrors(read.errors, stepName);
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFailure(null);
  };
  const next = () => {
    if (Object.keys(errorsOf(name)).length) {
      setChecked((current) => ({ ...current, [name]: true }));
      setFocusRequest((count) => count + 1);
      return;
    }
    setStep(step + 1);
    setReached((current) => Math.max(current, step + 1));
  };
  const submit = async () => {
    if (!read.terms || (mode === 'create' && !recipient) || saving) return;
    setSaving(true);
    setFailure(null);
    try {
      const id = await save(api, workspaceId, {
        mode,
        detail,
        draft,
        recipient,
        terms: read.terms,
      });
      onSaved(id);
    } catch (error) {
      setFailure(failureNotice(error));
      setSaving(false);
    }
  };
  return {
    steps,
    step,
    name,
    reached,
    draft,
    setDraft,
    change,
    recipient,
    setRecipient: (found) => {
      setRecipient(found);
      setFailure(null);
    },
    errors: checked[name] ? errorsOf(name) : {},
    terms: read.terms,
    dirty,
    saving,
    failure,
    formRef,
    next,
    back: () => setStep(Math.max(0, step - 1)),
    goTo: (index) => index <= reached && setStep(index),
    submit,
  };
}

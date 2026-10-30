import React, { useRef, useState } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormStepper } from '../../components/ui/FormStepper.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { TeamPersonFields } from './TeamPersonFields.jsx';
import { TeamAccessFields } from './TeamAccessFields.jsx';
import { TeamMemberReview } from './TeamMemberReview.jsx';
import { blankMember, memberError, memberPayload, teamSteps } from './model.js';

export function TeamMemberDialog({ member, roles, workspaceId, canInviteAdmin, onClose, onSaved }) {
  const { api } = useSession();
  const initial = useRef(blankMember(member));
  const [form, setForm] = useState(initial.current);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const formRef = useRef(null);
  const dirty = JSON.stringify(initial.current) !== JSON.stringify(form);
  useUnsavedChanges(dirty, busy);
  const change = (key, value, extra = {}) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...extra,
      ...(key === 'accountRole' && value === 'admin'
        ? {
            positions: [],
            permissions: Object.fromEntries(
              Object.keys(current.permissions).map((name) => [name, true]),
            ),
          }
        : {}),
    }));
    setError('');
  };
  const close = () => {
    if (!busy && (!dirty || confirm('Discard your unsaved team changes?'))) onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const issue = memberError(form, step);
    if (issue) {
      setError(issue);
      formRef.current?.querySelector('input')?.focus();
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      setError('');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = memberPayload(form, member);
      if (member?.status === 'invited' && !form.cancelInvitation) delete payload.active;
      const result = member
        ? await api.updateMember(workspaceId, member.id, payload)
        : await api.invite(workspaceId, payload);
      onSaved(member ? { member: result.member || result } : result);
    } catch (failure) {
      setError(
        failure.status === 409
          ? `${failure.message} Close and reopen this person to review their latest details.`
          : failure.message,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Drawer className="connected-team-dialog" titleId="team-member-title" onClose={close}>
      <div className="drawer-top">
        <div>
          <h2 id="team-member-title">{member ? 'Edit teammate' : 'Invite teammate'}</h2>
          <p>Access stays within the selected workspace.</p>
        </div>
        <Button variant="light" disabled={busy} onClick={close} aria-label="Close team form">
          Close
        </Button>
      </div>
      <FormStepper
        steps={teamSteps}
        activeStep={step}
        accessibleStep={step}
        disabled={busy}
        onSelect={(value) => {
          setStep(value);
          setError('');
        }}
      />
      <form ref={formRef} onSubmit={submit} className="connected-team-form">
        <div className="drawer-body">
          {step === 0 && (
            <TeamPersonFields
              form={form}
              change={change}
              editing={!!member}
              canInviteAdmin={canInviteAdmin}
              busy={busy}
            />
          )}
          {step === 1 && (
            <TeamAccessFields
              form={form}
              change={change}
              roles={roles}
              member={member}
              busy={busy}
            />
          )}
          {step === 2 && <TeamMemberReview form={form} roles={roles} editing={!!member} />}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={step ? () => setStep(step - 1) : close}>
            {step ? 'Back' : 'Cancel'}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Saving…'
              : step < 2
                ? 'Continue'
                : member
                  ? 'Save changes'
                  : 'Create invitation'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

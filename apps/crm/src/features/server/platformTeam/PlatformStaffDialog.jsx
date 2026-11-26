import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { FormSliderHead } from '../../../components/ui/FormSliderHead.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AreaTicks } from './AreaTicks.jsx';
import {
  PRESETS,
  PRESET_KEYS,
  blankStaff,
  cleanAccess,
  presetFor,
  setLevel,
  staffError,
} from './teamAreasModel.js';

/**
 * Invite a Blaqks One team member, or edit an existing one's access (BO1b): a position fills
 * each area's level (Off, View or Manage), and the saved levels decide. `member` edits;
 * without it the form invites.
 */
export function PlatformStaffDialog({ member, onClose, onSaved }) {
  const { api } = useSession();
  const { t } = useI18n();
  const titleId = useId();
  const [form, setForm] = useState(() =>
    member ? { ...blankStaff(), preset: member.preset, access: member.access } : blankStaff(),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const choosePreset = (preset) =>
    setForm((current) => ({
      ...current,
      preset,
      access: { ...(PRESETS[preset] || current.access) },
    }));
  const level = (area, value) =>
    setForm((current) => {
      const access = setLevel(current.access, area, value);
      return { ...current, access, preset: presetFor(access) };
    });
  const submit = async (event) => {
    event.preventDefault();
    const problem = staffError(form, !member);
    if (problem) return setError(t(problem));
    setBusy(true);
    setError('');
    try {
      const body = { preset: form.preset, access: cleanAccess(form.access) };
      const result = member
        ? await api.updatePlatformStaff(member.id, { ...body, version: member.version })
        : await api.invitePlatformStaff({
            ...body,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          });
      onSaved(result, member ? member.name : form.name.trim());
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const field = (key, type = 'text') => (
    <div className="field">
      <label htmlFor={`staff-${key}`}>{t(`platformTeam.${key}`)}</label>
      <input
        id={`staff-${key}`}
        type={type}
        value={form[key]}
        disabled={busy}
        onChange={(event) => set(key, event.target.value)}
      />
      {key === 'phone' && <small>{t('platformTeam.phoneHint')}</small>}
    </div>
  );
  return (
    <Drawer
      placement="right"
      className="editor-drawer form-slider"
      titleId={titleId}
      onClose={() => !busy && onClose()}
    >
      <FormSliderHead
        titleId={titleId}
        title={
          member
            ? t('platformTeam.editTitle', { name: member.name })
            : t('platformTeam.inviteTitle')
        }
        closeLabel={t('platformTeam.cancel')}
        busy={busy}
        onClose={onClose}
      />
      <form noValidate className="drawer-form" onSubmit={submit}>
        <div className="drawer-body platform-staff-form">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-card">
            {!member && (
              <div className="form-grid">
                {field('name')}
                {field('email', 'email')}
                {field('phone', 'tel')}
              </div>
            )}
            <div className="field">
              <label htmlFor="staff-role">{t('platformTeam.role')}</label>
              <select
                id="staff-role"
                value={form.preset}
                disabled={busy}
                onChange={(event) => choosePreset(event.target.value)}
              >
                {PRESET_KEYS.map((key) => (
                  <option key={key} value={key} disabled={key === 'custom'}>
                    {t(`platformTeam.preset.${key}`)}
                  </option>
                ))}
              </select>
              <small>{t('platformTeam.roleHint')}</small>
            </div>
            <AreaTicks access={form.access} onLevel={level} disabled={busy} />
          </div>
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={onClose}>
            {t('platformTeam.cancel')}
          </Button>
          <Button type="submit" icon="check" disabled={busy}>
            {busy
              ? t('platformTeam.saving')
              : t(member ? 'platformTeam.save' : 'platformTeam.sendInvite')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

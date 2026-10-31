import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { productSections } from './productModel.js';
import './start.css';

const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/**
 * The account menu on the person's initials (NAV1b): their personal settings and Sign out.
 * A disclosure, not an ARIA menu: plain buttons that Tab reaches, closed by Escape or a click
 * outside, returning focus to the initials.
 */
export function AccountMenu({ busy }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { navigate } = useNavigation();
  const go = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => !root.current?.contains(event.target) && setOpen(false);
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      opener.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const personal = productSections(user, 'settings').filter((section) => section.personal);
  const choose = (route) => {
    setOpen(false);
    navigate(route);
  };
  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        ref={opener}
        className="account-button"
        aria-label={t('start.account', { name: user.name })}
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {initials(user.name)}
      </button>
      {open && (
        <div className="account-panel" id="account-panel">
          <div className="account-who">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          {personal
            .filter((section) => canOpenSection(user, section.routes[0]))
            .map((section) => (
              <button type="button" key={section.key} onClick={() => choose(section.routes[0])}>
                {t(`products.sections.${section.key}`)}
              </button>
            ))}
          <hr />
          <button type="button" disabled={busy} onClick={() => go('/sign-out')}>
            {t('start.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

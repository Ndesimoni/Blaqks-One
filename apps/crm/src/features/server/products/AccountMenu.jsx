import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { useHelpUnread } from '../help/useHelpUnread.js';
import { productSections } from './productModel.js';
import { useDisclosure } from './useDisclosure.js';
import './start.css';
import './account-help.css';

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
  const { open, setOpen, root, opener } = useDisclosure();
  const personal = productSections(user, 'settings').filter((section) => section.personal);
  // New answers to the member's help requests (BO1c).
  const helpUnread = useHelpUnread(canOpenSection(user, 'Help'));
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
        {helpUnread > 0 && <span className="account-dot" aria-hidden="true" />}
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
                {section.key === 'help' && helpUnread > 0 && (
                  <span className="account-count">{helpUnread}</span>
                )}
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

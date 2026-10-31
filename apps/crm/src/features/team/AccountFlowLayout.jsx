import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../components/layout/BrandMark.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useWorkspacePreferences } from '../../hooks/useWorkspacePreferences.js';

export function AccountFlowLayout({ title, description, children }) {
  const { settings, setSettings } = useWorkspacePreferences();
  useEffect(() => {
    document.title = `${title} · Keys with Simoni`;
  }, [title]);
  return (
    <main className="account-flow-page">
      <div className="account-flow-shell">
        <header className="account-flow-header">
          <div className="brand">
            <BrandMark />
            <div>
              <strong>
                KEYS <i>WITH</i> SIMONI
              </strong>
              <span>REAL ESTATE STUDIO</span>
            </div>
          </div>
          <button
            className="theme-switch"
            type="button"
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() =>
              setSettings((previous) => ({
                ...previous,
                theme: previous.theme === 'dark' ? 'light' : 'dark',
              }))
            }
          >
            <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </header>
        <div className="account-flow-intro">
          <span className="team-preview-label">FRONTEND PREVIEW</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        <footer className="account-flow-footer">
          <Link to="/sign-in">Back to sign in</Link>
          <span>Keys with Simoni · Team workspace</span>
        </footer>
      </div>
    </main>
  );
}

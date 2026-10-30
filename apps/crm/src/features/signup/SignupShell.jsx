import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { SignupUtilities } from './SignupUtilities.jsx';

export function SignupShell({ children }) {
  const { t } = useI18n();
  return (
    <main className="sign-in-page signup-page">
      <div className="sign-in-shell signup-shell">
        <section className="sign-in-story signup-story" aria-label={t('signup.brand')}>
          <div className="signup-brand u-ltr">
            <span aria-hidden="true">B1</span>
            <strong>{t('signup.brand')}</strong>
          </div>
          <div className="sign-in-story-body">
            <span className="sign-in-eyebrow">{t('signup.storyEyebrow')}</span>
            <h2>{t('signup.storyTitle')}</h2>
            <p>{t('signup.storyBody')}</p>
            <ul className="signup-benefits">
              {['benefitOne', 'benefitTwo', 'benefitThree'].map((key) => (
                <li key={key}>
                  <Icon name="check" size={15} /> {t(`signup.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="sign-in-panel signup-panel">
          <SignupUtilities />
          <div className="signup-content">{children}</div>
          <footer className="sign-in-footer">{t('signup.footer')}</footer>
        </section>
      </div>
    </main>
  );
}

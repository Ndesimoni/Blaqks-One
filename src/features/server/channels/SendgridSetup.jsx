import React from 'react';

const STEPS = ['channels.sendgrid.step1', 'channels.sendgrid.step2', 'channels.sendgrid.step3'];

/** The three SendGrid steps that must be done before connecting (Connecting platforms guide). */
export function SendgridSetup({ t }) {
  return (
    <div className="channel-setup">
      <p>{t('channels.sendgrid.before')}</p>
      <ol>
        {STEPS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </div>
  );
}

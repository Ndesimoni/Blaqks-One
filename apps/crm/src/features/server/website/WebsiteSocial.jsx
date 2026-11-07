import React from 'react';
import { SettingsSection } from '../profile/SettingsSection.jsx';
import { SocialLinkFields } from './social/SocialLinkFields.jsx';

/**
 * Content tab → Social links for the company or general site. They follow the content flow:
 * Save draft keeps them private and Publish makes them public (docs/website-social-links.md).
 */
export function WebsiteSocial({ editor, platform, t }) {
  const { form, change, invalid, inputs } = editor;
  return (
    <SettingsSection
      id="website-social"
      title={t('websiteSocial.title')}
      description={t(platform ? 'websiteSocial.platformHint' : 'websiteSocial.companyHint')}
    >
      <div className="panel website-form-card">
        <SocialLinkFields
          idPrefix="website-social"
          legend={t('websiteSocial.title')}
          quietLegend
          hint={t('websiteSocial.hint')}
          values={form.social}
          errors={invalid}
          inputs={inputs}
          onChange={(field, value) => change(field, value, 'social')}
        />
      </div>
    </SettingsSection>
  );
}

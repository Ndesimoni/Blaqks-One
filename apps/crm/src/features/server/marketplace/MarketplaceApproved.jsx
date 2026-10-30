import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceJoin } from './MarketplaceJoin.jsx';
import { MarketplaceMine } from './MarketplaceMine.jsx';
import { MarketplaceSwitch } from './MarketplaceSwitch.jsx';

/**
 * Approved (broker marketplace §13, packet MK1b): the Admin sees the company switch; while the
 * switch is on, a member either joins or sees their own profile and the empty board. Staff read
 * why the marketplace is closed to them when the company turns it off.
 */
export function MarketplaceApproved({ company, member, admin, onChanged }) {
  const { t } = useI18n();
  return (
    <>
      <section className="market-card">
        <div className="market-approved-head">
          <h3>{t('marketplace.approved.title')}</h3>
          <Badge tone={company.enabled ? 'green' : 'slate'}>
            {company.enabled ? t('marketplace.switch.stateOn') : t('marketplace.switch.stateOff')}
          </Badge>
        </div>
        <p>{t('marketplace.approved.text')}</p>
        {admin ? (
          <MarketplaceSwitch company={company} onChanged={onChanged} />
        ) : (
          !company.enabled && <p className="market-hint">{t('marketplace.approved.offForStaff')}</p>
        )}
      </section>
      {company.enabled &&
        (member && member.joined ? (
          <MarketplaceMine member={member} onChanged={onChanged} />
        ) : (
          <MarketplaceJoin termsVersion={member && member.termsVersion} onChanged={onChanged} />
        ))}
    </>
  );
}

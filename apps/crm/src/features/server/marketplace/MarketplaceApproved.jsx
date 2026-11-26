import React, { useId } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceIntro } from './MarketplaceIntro.jsx';
import { MarketplaceJoin } from './MarketplaceJoin.jsx';
import { MarketplaceMine } from './MarketplaceMine.jsx';
import { MarketplaceSwitch } from './MarketplaceSwitch.jsx';

/** The company's access: approved, the switch's state and, for the Admin, the switch. */
function MarketplaceCompany({ company, admin, onChanged }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className="market-card market-company" aria-labelledby={id}>
      <div className="market-card-head">
        <h2 id={id}>{t('marketplace.approved.title')}</h2>
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
  );
}

/**
 * Approved (broker marketplace §13, packet MK1b). A joined member sees the section `view`
 * (the company's access below their broker profile); everyone else sees the company card and, while
 * the switch is on, the join card. Staff read why the marketplace is closed when it is off.
 */
export function MarketplaceApproved({ company, member, admin, view, onChanged }) {
  const card = <MarketplaceCompany company={company} admin={admin} onChanged={onChanged} />;
  if (company.enabled && member && member.joined)
    return (
      <>
        <MarketplaceMine member={member} view={view} onChanged={onChanged} />
        {view === 'profile' && card}
      </>
    );
  return (
    <div className="market-gate">
      <MarketplaceIntro />
      {card}
      {company.enabled && (
        <MarketplaceJoin termsVersion={member && member.termsVersion} onChanged={onChanged} />
      )}
    </div>
  );
}

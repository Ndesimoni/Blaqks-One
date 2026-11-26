import { HomeverseHome } from '../homeverse/HomeverseHome';
import { isHomeverse } from '../../lib/company-design';
import type { PageData } from '../../lib/types';
import { CompanyPeople } from './CompanyPeople';
import { CompanyAdvisor } from './CompanyAdvisor';
import { CompanyHome } from './CompanyHome';
import { CompanyProperties } from './CompanyProperties';
import { CompanyProperty } from './CompanyProperty';
import { CompanyAbout } from './CompanyAbout';
import { CompanyContact } from './CompanyContact';
import { CompanyClosing, CompanyServices } from './CompanySections';
import { DirectoryPage } from '../DirectoryPage';
import { ProfilePage } from '../ProfilePage';
import { CompanyEnquiry } from './CompanyEnquiry';
import { InfoPage } from '../InfoPage';

export function CompanyWebsite(data: PageData) {
  if (data.page === 'home')
    return isHomeverse(data.site) ? <HomeverseHome {...data} /> : <CompanyHome {...data} />;
  if (data.page === 'properties') return <CompanyProperties {...data} />;
  if (data.page === 'property') return <CompanyProperty {...data} />;
  if (data.page === 'agents') return <CompanyPeople {...data} />;
  if (data.page === 'agent') return <CompanyAdvisor {...data} />;
  if (data.page === 'about') return <CompanyAbout {...data} />;
  if (data.page === 'contact') return <CompanyContact {...data} />;
  if (data.page === 'services')
    return (
      <div className="a-container">
        <section className="a-page-intro">
          <p className="a-kicker">HOW WE CAN HELP</p>
          <h1>
            Every move.
            <br />
            Thoughtfully considered.
          </h1>
          <p>A simpler way to explore property and connect with the people behind it.</p>
        </section>
        <CompanyServices site={data.site} full />
        <CompanyClosing />
      </div>
    );
  return (
    <div className="a-inner">
      {['companies', 'agents', 'developers', 'areas'].includes(data.page) ? (
        <DirectoryPage {...data} />
      ) : ['company', 'agent', 'developer', 'area'].includes(data.page) ? (
        <ProfilePage {...data} />
      ) : data.page === 'enquiry' ? (
        <CompanyEnquiry {...data} />
      ) : (
        <InfoPage {...data} />
      )}
    </div>
  );
}

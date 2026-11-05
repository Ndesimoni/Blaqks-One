import type { PageData } from '../lib/types';
import { HomePage } from './HomePage';
import { PropertiesPage } from './PropertiesPage';
import { PropertyPage } from './PropertyPage';
import { DirectoryPage } from './DirectoryPage';
import { ProfilePage } from './ProfilePage';
import { InfoPage } from './InfoPage';
import { EnquiryPage } from './EnquiryPage';

export function WebsitePage(data: PageData) {
  if (data.page === 'home') return <HomePage {...data} />;
  if (data.page === 'properties') return <PropertiesPage {...data} />;
  if (data.page === 'property') return <PropertyPage {...data} />;
  if (['companies', 'agents', 'developers', 'areas'].includes(data.page))
    return <DirectoryPage {...data} />;
  if (['company', 'agent', 'developer', 'area'].includes(data.page))
    return <ProfilePage {...data} />;
  if (data.page === 'enquiry') return <EnquiryPage {...data} />;
  return <InfoPage {...data} />;
}
export default WebsitePage;

/**
 * The workspace-scoped route groups, composed once for `createCrmClient` (service boundaries
 * rule 10: one client file per domain). Each group only needs the shared request and the
 * workspace scope helper.
 */
import { activityRoutes } from './activity.js';
import { agreementRoutes } from './agreements.js';
import { chatRoutes } from './chat.js';
import { companyRoutes } from './company.js';
import { financeRoutes } from './finance.js';
import { importRoutes } from './imports.js';
import { inboxRoutes } from './inbox.js';
import { integrationRoutes } from './integrations.js';
import { marketplaceRoutes } from './marketplace.js';
import { performanceRoutes } from './performance.js';
import { recordShareRoutes } from './recordShares.js';

export function scopedRoutes({ request, scope }) {
  return {
    ...activityRoutes({ request, scope }),
    ...financeRoutes({ request, scope }),
    ...performanceRoutes({ request, scope }),
    ...companyRoutes({ request, scope }),
    ...integrationRoutes({ request, scope }),
    ...inboxRoutes({ request, scope }),
    ...chatRoutes({ request, scope }),
    ...agreementRoutes({ request, scope }),
    ...marketplaceRoutes({ request, scope }),
    ...importRoutes({ request, scope }),
    ...recordShareRoutes({ request, scope }),
  };
}

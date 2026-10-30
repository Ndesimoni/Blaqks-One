import { companyPayload, setupError } from '../../signup/signupModel.js';

export const companyDraft = (company) => ({
  displayName: company?.displayName || '',
  emirate: company?.emirate || '',
});

export const companyDraftError = (draft) => setupError(draft);

export const companyDraftPayload = (company, draft) => companyPayload(company, draft);

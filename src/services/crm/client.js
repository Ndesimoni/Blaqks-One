import { accountRoutes } from './account.js';
import { activityRoutes } from './activity.js';
import { assignmentRoutes } from './assignments.js';
import { chatRoutes } from './chat.js';
import { companyRoutes, readCompany } from './company.js';
import { financeRoutes } from './finance.js';
import { inboxRoutes } from './inbox.js';
import { integrationRoutes } from './integrations.js';
import { performanceRoutes } from './performance.js';
import { signupRoutes } from './signup.js';

export class CrmApiError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'CrmApiError';
    this.status = status;
    this.details = details;
  }
}

/** Sessions use HttpOnly cookies; the anti-forgery token lives only in memory. */
export function createCrmClient(fetchRequest = globalThis.fetch, onUnauthorized = () => {}) {
  let csrfToken = '';
  // `file` sends one raw file (media uploads); `body` sends JSON.
  const request = async (path, { method = 'GET', body, file, signal, keepalive } = {}) => {
    let response;
    try {
      response = await fetchRequest(`/api/crm${path}`, {
        method,
        credentials: 'include',
        signal,
        keepalive,
        headers: {
          Accept: 'application/json',
          ...(file
            ? {
                'Content-Type': 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name || 'file'),
              }
            : body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        ...(file ? { body: file } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new CrmApiError('The CRM server could not be reached. Please try again.', 0);
    }
    const json = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') {
      csrfToken = '';
      onUnauthorized(path);
    }
    if (!response.ok)
      throw new CrmApiError(
        json.message || 'The CRM request could not be completed.',
        response.status,
        json,
      );
    return json;
  };
  const identityEnvelope = async (path, options) => {
    const session = await request(path, options);
    if (!session.user?.id || typeof session.csrfToken !== 'string' || !session.csrfToken)
      throw new CrmApiError(
        'The server returned an incomplete session. Please sign in again.',
        502,
      );
    csrfToken = session.csrfToken;
    return session;
  };
  const identity = async (path, options) => (await identityEnvelope(path, options)).user;
  const identityWithCompany = async (path, options) => {
    const session = await identityEnvelope(path, options);
    return { ...session, company: readCompany(session.company) };
  };
  /** Swaps the in-memory anti-forgery token after the server rotates the session. */
  const setCsrfToken = (token) => {
    csrfToken = token;
  };
  const scope = (workspace) => `/workspaces/${encodeURIComponent(workspace)}`;
  const recordPath = (workspace, collection, id) =>
    `${scope(workspace)}/records/${encodeURIComponent(collection)}${id ? `/${encodeURIComponent(id)}` : ''}`;
  return {
    session: (signal) => identity('/auth/session', { signal }),
    sessionWithCompany: (signal) => identityWithCompany('/auth/session', { signal }),
    login: (email, password) =>
      identity('/auth/login', { method: 'POST', body: { email, password } }),
    loginWithCompany: (email, password) =>
      identityWithCompany('/auth/login', { method: 'POST', body: { email, password } }),
    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch (error) {
        if (error.status !== 401) throw error;
      }
      csrfToken = '';
    },
    workspaces: (signal) => request('/workspaces', { signal }),
    team: (workspace, signal, archived = false) =>
      request(`${scope(workspace)}/team${archived ? '?archived=true' : ''}`, { signal }),
    archivePreview: (workspace, id, signal) =>
      request(`${scope(workspace)}/team/${encodeURIComponent(id)}/archive-preview`, { signal }),
    archiveMember: (workspace, id, body) =>
      request(`${scope(workspace)}/team/${encodeURIComponent(id)}`, { method: 'DELETE', body }),
    invite: (workspace, body) =>
      request(`${scope(workspace)}/team/invitations`, { method: 'POST', body }),
    updateMember: (workspace, id, body) =>
      request(`${scope(workspace)}/team/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    renewInvitation: (workspace, id, version) =>
      request(`${scope(workspace)}/team/${encodeURIComponent(id)}/invitations`, {
        method: 'POST',
        body: { version },
      }),
    inspectInvitation: (token, signal) =>
      request('/auth/invitations/inspect', { method: 'POST', body: { token }, signal }),
    acceptInvitation: (token, password) =>
      request('/auth/invitations/accept', { method: 'POST', body: { token, password } }),
    records: (workspace, signal) => request(`${scope(workspace)}/records`, { signal }),
    previewImport: (workspace, payload) =>
      request(`${scope(workspace)}/imports/preview`, { method: 'POST', body: payload }),
    commitImport: (workspace, token) =>
      request(`${scope(workspace)}/imports/commit`, { method: 'POST', body: { token } }),
    save: (workspace, collection, record, metadata) =>
      request(recordPath(workspace, collection, metadata?.id), {
        method: metadata ? 'PATCH' : 'POST',
        body: { record, ...(metadata ? { version: metadata.version } : {}) },
      }),
    remove: (workspace, collection, metadata) =>
      request(recordPath(workspace, collection, metadata.id), {
        method: 'DELETE',
        body: { version: metadata.version },
      }),
    ...accountRoutes({ request, setCsrfToken }),
    ...activityRoutes({ request, scope }),
    ...assignmentRoutes({ request, scope, recordPath }),
    ...financeRoutes({ request, scope }),
    ...performanceRoutes({ request, scope }),
    ...companyRoutes({ request, scope }),
    ...integrationRoutes({ request, scope }),
    ...inboxRoutes({ request, scope }),
    ...chatRoutes({ request, scope }),
    ...signupRoutes({ request, setCsrfToken }),
  };
}

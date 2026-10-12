import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { labels } from '../config/navigation.js';
import { routeName, routePath } from '../config/routes.js';

export function useWorkspaceNavigation(dashboardPath = '/') {
  const { pathname, search } = useLocation();
  const go = useNavigate();
  const route =
    pathname.replace(/\/$/, '') === dashboardPath.replace(/\/$/, '')
      ? 'Dashboard'
      : routeName(pathname);
  const initialQuery = new URLSearchParams(search).get('q') || '';
  const workspaceId = new URLSearchParams(search).get('workspace');
  const navigate = useCallback(
    (name, query = '') => {
      const params = new URLSearchParams();
      if (workspaceId) params.set('workspace', workspaceId);
      if (query) params.set('q', query);
      const path = name === 'Dashboard' ? dashboardPath : routePath(name);
      go(path + (params.size ? `?${params}` : ''));
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    },
    [go, workspaceId, dashboardPath],
  );
  useEffect(() => {
    document.title = `${labels[route] || route} · Keys with Simoni`;
  }, [route]);
  return useMemo(() => ({ route, navigate, initialQuery }), [route, navigate, initialQuery]);
}

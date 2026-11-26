import { useEffect, useMemo, useState } from 'react';
import { dateShift, today } from '../lib/dates.js';
import { defaultPropertyFilters } from '../features/properties/selectors.js';

export function useWorkspaceViewState(route, initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState('All');
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [detail, setDetail] = useState(null);
  const [messageDraft, setMessageDraft] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [propertyFilters, setPropertyFilters] = useState(defaultPropertyFilters);
  const [selectedClient, setSelectedClient] = useState('CL-001');
  const [dateFilter, setDateFilter] = useState({
    type: 'New enquiries',
    start: dateShift(-30),
    end: today(),
  });
  const [reportMonth, setReportMonth] = useState(today().slice(0, 7));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setTab('All');
    setQuery(initialQuery);
    setSort({ key: '', direction: 'asc' });
    setPage(0);
    setViewMode('cards');
    setPropertyFilters(defaultPropertyFilters());
    setMobileNav(false);
    setDetail(null);
    setDrawer(null);
    setMessageDraft(null);
    setShowMenu(false);
  }, [route, initialQuery]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        setMobileNav(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return useMemo(
    () => ({
      query,
      setQuery,
      tab,
      setTab,
      sort,
      setSort,
      page,
      setPage,
      drawer,
      setDrawer,
      mobileNav,
      setMobileNav,
      toast,
      setToast,
      showMenu,
      setShowMenu,
      detail,
      setDetail,
      messageDraft,
      setMessageDraft,
      viewMode,
      setViewMode,
      propertyFilters,
      setPropertyFilters,
      selectedClient,
      setSelectedClient,
      dateFilter,
      setDateFilter,
      reportMonth,
      setReportMonth,
    }),
    [
      query,
      tab,
      sort,
      page,
      drawer,
      mobileNav,
      toast,
      showMenu,
      detail,
      messageDraft,
      viewMode,
      propertyFilters,
      selectedClient,
      dateFilter,
      reportMonth,
    ],
  );
}

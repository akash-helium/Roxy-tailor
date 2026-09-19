import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from './useAppData';
import {
  CLOTH_PAGE_SIZE,
  countClothsByStatus,
  EMPTY_CLOTH_COUNTS,
  filterCloths,
  type ClothListCounts,
  type ClothStatusFilter,
} from '../lib/cloth-list';
import { fetchClothStatusCounts, fetchClothsPage } from '../lib/data';
import type { Cloth } from '../types';

export function useClothList() {
  const { cloths: localCloths, staff, loading: appLoading, error: appError, refetch, mode } =
    useAppData();

  const [statusFilter, setStatusFilter] = useState<ClothStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  const [remoteCloths, setRemoteCloths] = useState<Cloth[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [counts, setCounts] = useState<ClothListCounts>(EMPTY_CLOTH_COUNTS);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, debouncedSearch]);

  const loadRemotePage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      setListLoading(true);
      setListError(null);

      try {
        const [{ cloths, total }, statusCounts] = await Promise.all([
          fetchClothsPage({
            page: pageToLoad,
            pageSize: CLOTH_PAGE_SIZE,
            status: statusFilter,
            search: debouncedSearch,
          }),
          fetchClothStatusCounts(),
        ]);

        setRemoteCloths((prev) => (replace ? cloths : [...prev, ...cloths]));
        setRemoteTotal(total);
        setCounts(statusCounts);
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Failed to load cloths');
        if (replace) {
          setRemoteCloths([]);
          setRemoteTotal(0);
        }
      } finally {
        setListLoading(false);
      }
    },
    [statusFilter, debouncedSearch],
  );

  useEffect(() => {
    if (mode !== 'supabase' || appLoading) return;
    void loadRemotePage(0, true);
  }, [mode, appLoading, loadRemotePage]);

  const localFiltered = useMemo(
    () => filterCloths(localCloths, statusFilter, debouncedSearch),
    [localCloths, statusFilter, debouncedSearch],
  );

  const localCounts = useMemo(() => countClothsByStatus(localCloths), [localCloths]);

  const localVisible = useMemo(
    () => localFiltered.slice(0, (page + 1) * CLOTH_PAGE_SIZE),
    [localFiltered, page],
  );

  const cloths = mode === 'supabase' ? remoteCloths : localVisible;
  const total = mode === 'supabase' ? remoteTotal : localFiltered.length;
  const statusCounts = mode === 'supabase' ? counts : localCounts;
  const hasMore = cloths.length < total;
  const loading = appLoading || (mode === 'supabase' && listLoading && cloths.length === 0);

  const loadMore = useCallback(async () => {
    if (!hasMore || listLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);

    if (mode === 'supabase') {
      await loadRemotePage(nextPage, false);
    }
  }, [hasMore, listLoading, page, mode, loadRemotePage]);

  const refreshList = useCallback(async () => {
    await refetch();
    setPage(0);
    if (mode === 'supabase') {
      await loadRemotePage(0, true);
    }
  }, [refetch, mode, loadRemotePage]);

  return {
    cloths,
    allCloths: localCloths,
    staff,
    mode,
    loading,
    error: appError ?? listError,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    statusCounts,
    total,
    hasMore,
    listLoading,
    loadMore,
    refreshList,
  };
}

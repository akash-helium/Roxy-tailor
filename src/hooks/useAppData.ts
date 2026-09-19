import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getLocalSnapshot, importLocalData } from '../lib/local-store';
import { canReadFromSupabase, resolveReadStorageMode, type StorageMode } from '../lib/storage-mode';
import { syncLocalDataToRemote } from '../lib/sync-local';
import * as remote from '../lib/db';
import type { AppData } from '../types';

type UseAppDataOptions = {
  /** Admin panel: always load from Supabase, never browser-only local storage */
  cloudOnly?: boolean;
};

export function useAppData(options: UseAppDataOptions = {}) {
  const { cloudOnly = false } = options;
  const { user } = useAuth();
  const [data, setData] = useState<AppData>({ staff: [], cloths: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StorageMode>('local');
  const modeRef = useRef<StorageMode>('local');

  const refetch = useCallback(async () => {
    if (!user) {
      setData({ staff: [], cloths: [] });
      return;
    }

    const useCloud = cloudOnly || (await canReadFromSupabase());
    const storageMode = useCloud ? 'supabase' : await resolveReadStorageMode();
    modeRef.current = storageMode;
    setMode(storageMode);

    if (!useCloud) {
      setData(getLocalSnapshot());
      setError(null);
      return;
    }

    try {
      // Cloud-first: always show Supabase data. Push phone-local rows only if cloud is empty.
      const [staff, cloths] = await Promise.all([remote.fetchStaff(), remote.fetchCloths()]);

      if (!cloudOnly && staff.length === 0 && cloths.length === 0) {
        await syncLocalDataToRemote();
        const [syncedStaff, syncedCloths] = await Promise.all([
          remote.fetchStaff(),
          remote.fetchCloths(),
        ]);
        const next = { staff: syncedStaff, cloths: syncedCloths };
        setData(next);
        importLocalData(next, { silent: true });
      } else {
        const next = { staff, cloths };
        setData(next);
        if (!cloudOnly) {
          importLocalData(next, { silent: true });
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data from cloud');
    }
  }, [user, cloudOnly]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setData({ staff: [], cloths: [] });
      return;
    }

    setLoading(true);
    refetch().finally(() => setLoading(false));

    const channel = supabase
      .channel('tailor-app-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        void refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cloths' }, () => {
        void refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return { ...data, loading, error, refetch, mode };
}

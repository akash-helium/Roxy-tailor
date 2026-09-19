import { useEffect } from 'react';
import { useAppData } from '@app/hooks/useAppData';
import { resetStorageModeCache } from '@app/lib/storage-mode';

/** Admin always reads shared Supabase shop data (not browser local storage). */
export function useAdminAppData() {
  useEffect(() => {
    resetStorageModeCache();
  }, []);

  return useAppData({ cloudOnly: true });
}

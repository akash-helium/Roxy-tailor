import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGarmentCatalog } from '../contexts/GarmentCatalogContext';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { resolveShopUserId } from '../lib/shop-user';
import { syncLocalDataToRemote, pullRemoteDataToLocal } from '../lib/sync-local';
import { resetStorageModeCache } from '../lib/storage-mode';

/**
 * On login / app start: sync shop data and refresh cloth types + staff types from Supabase.
 */
export function CloudBootstrap() {
  const { user, loading } = useAuth();
  const { reload: reloadCatalog } = useGarmentCatalog();
  const { reload: reloadStaffTypes } = useStaffTypes();

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured) return;

    let cancelled = false;

    async function bootstrap() {
      resetStorageModeCache();
      const shopUserId = await resolveShopUserId();
      if (!shopUserId || cancelled) return;

      try {
        await pullRemoteDataToLocal();
        await syncLocalDataToRemote();
        if (!cancelled) {
          await Promise.all([reloadCatalog(), reloadStaffTypes()]);
        }
      } catch (err) {
        console.error('[CloudBootstrap] sync failed:', err);
        if (!cancelled) {
          await Promise.all([reloadCatalog(), reloadStaffTypes()]);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [user, loading, reloadCatalog, reloadStaffTypes]);

  return null;
}

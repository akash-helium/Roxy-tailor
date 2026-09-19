import { supabase, isSupabaseConfigured } from './supabase';
import { hasLocalSession } from './auth-config';
import { resolveShopUserId, resetShopUserCache } from './shop-user';

export type StorageMode = 'local' | 'supabase';

let cachedReadMode: StorageMode | null = null;

/** True when Supabase is configured and staff/cloths tables are reachable (shared shop RLS). */
export async function canReadFromSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('staff').select('id').limit(1);
    if (error?.code === 'PGRST205' || error?.code === '42P01') return false;
    return !error;
  } catch {
    return false;
  }
}

/** True when we can insert rows (needs shop admin user id for user_id column). */
export async function canWriteToSupabase(): Promise<boolean> {
  if (!(await canReadFromSupabase())) return false;
  const shopUserId = await resolveShopUserId();
  return Boolean(shopUserId);
}

export async function resolveReadStorageMode(): Promise<StorageMode> {
  const mode = (await canReadFromSupabase()) ? 'supabase' : 'local';
  cachedReadMode = mode;
  return mode;
}

export async function resolveWriteStorageMode(): Promise<StorageMode> {
  return (await canWriteToSupabase()) ? 'supabase' : 'local';
}

/** @deprecated Use resolveReadStorageMode */
export async function detectStorageMode(options?: { cloudOnly?: boolean }): Promise<StorageMode> {
  if (options?.cloudOnly) return resolveReadStorageMode();
  return resolveReadStorageMode();
}

export function resetStorageModeCache() {
  cachedReadMode = null;
  resetShopUserCache();
}

export function getStorageModeSync(): StorageMode {
  if (cachedReadMode) return cachedReadMode;
  if (hasLocalSession()) return 'local';
  return 'local';
}

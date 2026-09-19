import { supabase } from './supabase';
import { DEFAULT_LOGIN_ID } from './auth-config';

let cachedShopUserId: string | null = null;

export function resetShopUserCache() {
  cachedShopUserId = null;
}

export async function resolveShopUserId(): Promise<string | null> {
  if (cachedShopUserId) return cachedShopUserId;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    cachedShopUserId = sessionData.session.user.id;
    return cachedShopUserId;
  }

  const envId = import.meta.env.VITE_SHOP_USER_ID?.trim();
  if (envId) {
    cachedShopUserId = envId;
    return envId;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('login_id', DEFAULT_LOGIN_ID)
    .maybeSingle();

  if (!error && data?.id) {
    cachedShopUserId = data.id;
    return data.id;
  }

  return null;
}

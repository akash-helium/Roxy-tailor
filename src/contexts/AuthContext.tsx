import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  clearLocalSession,
  getAccessToken,
  hasLocalSession,
  isDefaultCredentials,
  LOCAL_USER,
  loginIdToEmail,
  formatLoginError,
  setLocalSession,
} from '../lib/auth-config';
import { resetStorageModeCache } from '../lib/storage-mode';

const CLOUD_AUTH_TIMEOUT_MS = 5000;

function activateLocalUser(
  setSession: (session: Session | null) => void,
  setUser: (user: User | null) => void,
  setIsLocalAuth: (value: boolean) => void,
) {
  setLocalSession();
  setSession(null);
  setUser(LOCAL_USER as unknown as User);
  setIsLocalAuth(true);
  resetStorageModeCache();
}

async function signInWithPasswordTimed(email: string, password: string) {
  return Promise.race([
    supabase.auth.signInWithPassword({ email, password }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error('Cloud login timed out. Using offline login.'));
      }, CLOUD_AUTH_TIMEOUT_MS);
    }),
  ]);
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  isLocalAuth: boolean;
  signIn: (loginId: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLocalAuth, setIsLocalAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      resetStorageModeCache();
      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: Session | null } }>((resolve) => {
            window.setTimeout(() => resolve({ data: { session: null } }), CLOUD_AUTH_TIMEOUT_MS);
          }),
        ]);
        if (!mounted) return;

        if (data.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          setIsLocalAuth(false);
          clearLocalSession();
        } else if (hasLocalSession()) {
          activateLocalUser(setSession, setUser, setIsLocalAuth);
        }
      } catch {
        if (mounted && hasLocalSession()) {
          activateLocalUser(setSession, setUser, setIsLocalAuth);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      resetStorageModeCache();
      if (nextSession?.user) {
        setSession(nextSession);
        setUser(nextSession.user);
        setIsLocalAuth(false);
        clearLocalSession();
      } else if (!hasLocalSession()) {
        setSession(null);
        setUser(null);
        setIsLocalAuth(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (loginId: string, password: string) => {
    resetStorageModeCache();

    if (!isSupabaseConfigured) {
      if (isDefaultCredentials(loginId, password)) {
        activateLocalUser(setSession, setUser, setIsLocalAuth);
        return { error: null };
      }
      return { error: 'Incorrect password' };
    }

    try {
      const email = loginIdToEmail(loginId);
      const { data, error } = await signInWithPasswordTimed(email, password);

      if (!error && data.session?.user) {
        clearLocalSession();
        setSession(data.session);
        setUser(data.session.user);
        setIsLocalAuth(false);
        resetStorageModeCache();
        return { error: null };
      }

      if (isDefaultCredentials(loginId, password)) {
        activateLocalUser(setSession, setUser, setIsLocalAuth);
        return { error: null };
      }

      return { error: formatLoginError(error?.message) };
    } catch {
      if (isDefaultCredentials(loginId, password)) {
        activateLocalUser(setSession, setUser, setIsLocalAuth);
        return { error: null };
      }

      return { error: 'Could not reach the server. Check your connection and try again.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearLocalSession();
    setIsLocalAuth(false);
    setUser(null);
    setSession(null);
    resetStorageModeCache();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      accessToken: getAccessToken(session),
      loading,
      isLocalAuth,
      signIn,
      signOut,
    }),
    [user, session, loading, isLocalAuth, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

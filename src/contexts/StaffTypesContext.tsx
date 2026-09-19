import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { StaffRoleType } from '../types';
import { ensureStaffTypesInDb, loadStaffTypesState, staffTypeLabel } from '../lib/staff-types-db';

type StaffTypesContextValue = {
  types: StaffRoleType[];
  loading: boolean;
  dbBacked: boolean;
  error: string | null;
  reload: () => Promise<void>;
  initialize: () => Promise<void>;
  getLabel: (slug: string) => string;
};

const StaffTypesContext = createContext<StaffTypesContextValue | null>(null);

export function StaffTypesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [types, setTypes] = useState<StaffRoleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbBacked, setDbBacked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadStaffTypesState();
      setTypes(result.items);
      setDbBacked(result.dbBacked);
      setError(result.error);
    } finally {
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await ensureStaffTypesInDb();
      setTypes(items);
      setDbBacked(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize staff types');
    } finally {
      setLoading(false);
    }
  }, []);

  const getLabel = useCallback((slug: string) => staffTypeLabel(slug, types), [types]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (authLoading || !user) return;
    void reload();
  }, [user, authLoading, reload]);

  useEffect(() => {
    const channel = supabase
      .channel('staff-types-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_types' }, () => {
        void reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return (
    <StaffTypesContext.Provider value={{ types, loading, dbBacked, error, reload, initialize, getLabel }}>
      {children}
    </StaffTypesContext.Provider>
  );
}

export function useStaffTypes() {
  const ctx = useContext(StaffTypesContext);
  if (!ctx) {
    throw new Error('useStaffTypes must be used within StaffTypesProvider');
  }
  return ctx;
}

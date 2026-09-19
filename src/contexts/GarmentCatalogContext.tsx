import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { setActiveGarmentCatalog, type GarmentType } from '../lib/garments';
import { ensureGarmentCatalogInDb, loadGarmentCatalogState } from '../lib/garment-catalog-db';

type GarmentCatalogContextValue = {
  catalog: GarmentType[];
  loading: boolean;
  dbBacked: boolean;
  error: string | null;
  reload: () => Promise<void>;
  initialize: () => Promise<void>;
};

const GarmentCatalogContext = createContext<GarmentCatalogContextValue | null>(null);

export function GarmentCatalogProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [catalog, setCatalog] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbBacked, setDbBacked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCatalog = useCallback((items: GarmentType[]) => {
    setActiveGarmentCatalog(items);
    setCatalog(items);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadGarmentCatalogState();
      applyCatalog(result.items);
      setDbBacked(result.dbBacked);
      setError(result.error);
    } catch (err) {
      applyCatalog([]);
      setDbBacked(false);
      setError(err instanceof Error ? err.message : 'Failed to load cloth types');
    } finally {
      setLoading(false);
    }
  }, [applyCatalog]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await ensureGarmentCatalogInDb();
      applyCatalog(items);
      setDbBacked(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize cloth types');
    } finally {
      setLoading(false);
    }
  }, [applyCatalog]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (authLoading || !user) return;
    void reload();
  }, [user, authLoading, reload]);

  useEffect(() => {
    const channel = supabase
      .channel('garment-types-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garment_types' }, () => {
        void reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return (
    <GarmentCatalogContext.Provider value={{ catalog, loading, dbBacked, error, reload, initialize }}>
      {children}
    </GarmentCatalogContext.Provider>
  );
}

export function useGarmentCatalog() {
  const ctx = useContext(GarmentCatalogContext);
  if (!ctx) {
    throw new Error('useGarmentCatalog must be used within GarmentCatalogProvider');
  }
  return ctx;
}

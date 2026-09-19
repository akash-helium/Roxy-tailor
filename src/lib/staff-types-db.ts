import { supabase, isSupabaseConfigured } from './supabase';
import { resolveShopUserId } from './shop-user';
import { DEFAULT_STAFF_TYPES, type StaffRoleType } from '../types';

type StaffTypeRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  is_system: boolean;
  sort_order: number;
};

function rowToStaffRoleType(row: StaffTypeRow): StaffRoleType {
  return {
    slug: row.slug,
    dbId: row.id,
    label: row.label,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function uniqueStaffTypeSlug(label: string, excludeDbId?: string) {
  const userId = await resolveShopUserId();
  if (!userId) throw new Error('Shop user not configured');

  const base = slugify(label) || 'staff_type';
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from('staff_types')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', candidate)
      .maybeSingle();

    if (!data || (excludeDbId && data.id === excludeDbId)) return candidate;
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
}

export async function fetchStaffTypesFromDb(): Promise<StaffRoleType[]> {
  const { data, error } = await supabase
    .from('staff_types')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => rowToStaffRoleType(row as StaffTypeRow));
}

export async function seedDefaultStaffTypes() {
  const userId = await resolveShopUserId();
  if (!userId) return false;

  const { count, error: countError } = await supabase
    .from('staff_types')
    .select('id', { count: 'exact', head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return false;

  const rows = DEFAULT_STAFF_TYPES.map((item, index) => ({
    user_id: userId,
    slug: item.slug,
    label: item.label,
    is_system: true,
    sort_order: index,
  }));

  const { error } = await supabase.from('staff_types').insert(rows);
  if (error) throw error;
  return true;
}

export async function loadStaffTypesState(): Promise<{
  items: StaffRoleType[];
  dbBacked: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { items: DEFAULT_STAFF_TYPES, dbBacked: false, error: null };
  }

  try {
    const items = await fetchStaffTypesFromDb();
    if (items.length === 0) {
      return {
        items: DEFAULT_STAFF_TYPES,
        dbBacked: false,
        error: 'No staff types in cloud yet. Initialize them in the admin panel.',
      };
    }
    return {
      items,
      dbBacked: items.every((item) => Boolean(item.dbId)),
      error: null,
    };
  } catch (err) {
    return {
      items: DEFAULT_STAFF_TYPES,
      dbBacked: false,
      error: err instanceof Error ? err.message : 'Failed to load staff types from cloud',
    };
  }
}

export async function ensureStaffTypesInDb(): Promise<StaffRoleType[]> {
  let items = await fetchStaffTypesFromDb();
  if (items.length === 0) {
    await seedDefaultStaffTypes();
    items = await fetchStaffTypesFromDb();
  }
  if (items.length === 0) {
    throw new Error('Could not initialize staff types in database');
  }
  return items;
}

async function nextStaffTypeSortOrder() {
  const { count, error } = await supabase
    .from('staff_types')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function createStaffType(label: string) {
  const userId = await resolveShopUserId();
  if (!userId) throw new Error('Shop user not configured');

  const slug = await uniqueStaffTypeSlug(label);
  const { data, error } = await supabase
    .from('staff_types')
    .insert({
      user_id: userId,
      slug,
      label: label.trim(),
      is_system: false,
      sort_order: await nextStaffTypeSortOrder(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToStaffRoleType(data as StaffTypeRow);
}

export async function deleteStaffType(dbId: string) {
  const { data: row, error: fetchError } = await supabase
    .from('staff_types')
    .select('is_system')
    .eq('id', dbId)
    .single();

  if (fetchError) throw fetchError;
  if (row.is_system) {
    throw new Error('Default staff types cannot be deleted');
  }

  const { error } = await supabase.from('staff_types').delete().eq('id', dbId);
  if (error) throw error;
}

export function staffTypeLabel(slug: string, types: StaffRoleType[]) {
  return types.find((item) => item.slug === slug)?.label ?? slug;
}

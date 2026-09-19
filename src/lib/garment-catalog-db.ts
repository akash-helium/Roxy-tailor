import { supabase, isSupabaseConfigured } from './supabase';
import { resolveShopUserId } from './shop-user';
import {
  GARMENT_CATALOG,
  normalizeMeasurementFields,
  type GarmentGender,
  type GarmentType,
  type MeasurementField,
} from './garments';

type GarmentTypeRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  gender: string;
  fields: MeasurementField[] | null;
  sort_order: number;
};

function parseMeasurementFields(value: unknown): MeasurementField[] {
  return normalizeMeasurementFields(value);
}

function rowToGarmentType(row: GarmentTypeRow): GarmentType {
  return {
    id: row.slug,
    dbId: row.id,
    label: row.label,
    gender: row.gender === 'female' ? 'female' : 'male',
    fields: parseMeasurementFields(row.fields),
  };
}

async function nextGarmentSortOrder() {
  const { count, error } = await supabase
    .from('garment_types')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function uniqueSlug(label: string, gender: GarmentGender, excludeDbId?: string) {
  const userId = await resolveShopUserId();
  if (!userId) throw new Error('Shop user not configured');

  const base = `${slugify(label)}_${gender}`;
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from('garment_types')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', candidate)
      .maybeSingle();

    if (!data || (excludeDbId && data.id === excludeDbId)) return candidate;
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
}

export async function fetchGarmentCatalogFromDb(): Promise<GarmentType[]> {
  const { data, error } = await supabase
    .from('garment_types')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => rowToGarmentType(row as GarmentTypeRow));
}

export async function seedDefaultGarmentCatalog() {
  const userId = await resolveShopUserId();
  if (!userId) return false;

  const { count, error: countError } = await supabase
    .from('garment_types')
    .select('id', { count: 'exact', head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return false;

  const rows = GARMENT_CATALOG.map((garment, index) => ({
    user_id: userId,
    slug: garment.id,
    label: garment.label,
    gender: garment.gender,
    fields: garment.fields,
    sort_order: index,
  }));

  const { error } = await supabase.from('garment_types').insert(rows);
  if (error) throw error;
  return true;
}

export async function loadGarmentCatalog(): Promise<GarmentType[]> {
  const result = await loadGarmentCatalogState();
  return result.items;
}

export async function loadGarmentCatalogState(): Promise<{
  items: GarmentType[];
  dbBacked: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { items: GARMENT_CATALOG, dbBacked: false, error: null };
  }

  try {
    const items = await fetchGarmentCatalogFromDb();
    if (items.length === 0) {
      return {
        items: [],
        dbBacked: false,
        error: 'No cloth types in cloud yet. Add them in the admin panel.',
      };
    }
    return {
      items,
      dbBacked: items.every((item) => Boolean(item.dbId)),
      error: null,
    };
  } catch (err) {
    return {
      items: [],
      dbBacked: false,
      error: err instanceof Error ? err.message : 'Failed to load cloth types from cloud',
    };
  }
}

export async function ensureGarmentCatalogInDb(): Promise<GarmentType[]> {
  let items = await fetchGarmentCatalogFromDb();
  if (items.length === 0) {
    await seedDefaultGarmentCatalog();
    items = await fetchGarmentCatalogFromDb();
  }
  if (items.length === 0) {
    throw new Error('Could not initialize cloth types in database');
  }
  return items;
}

export async function createGarmentType(input: {
  label: string;
  gender: GarmentGender;
  fields?: MeasurementField[];
}) {
  const userId = await resolveShopUserId();
  if (!userId) throw new Error('Shop user not configured');

  const slug = await uniqueSlug(input.label, input.gender);
  const { data, error } = await supabase
    .from('garment_types')
    .insert({
      user_id: userId,
      slug,
      label: input.label.trim(),
      gender: input.gender,
      fields: input.fields ?? [],
      sort_order: await nextGarmentSortOrder(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToGarmentType(data as GarmentTypeRow);
}

export async function updateGarmentType(
  dbId: string,
  input: {
    label?: string;
    gender?: GarmentGender;
    fields?: MeasurementField[];
  },
) {
  const update: {
    label?: string;
    gender?: GarmentGender;
    fields?: MeasurementField[];
    slug?: string;
  } = {};

  if (input.label !== undefined) update.label = input.label.trim();
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.fields !== undefined) update.fields = input.fields;

  if (input.label && input.gender) {
    update.slug = await uniqueSlug(input.label, input.gender, dbId);
  }

  const { data, error } = await supabase
    .from('garment_types')
    .update(update)
    .eq('id', dbId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGarmentType(data as GarmentTypeRow);
}

export async function deleteGarmentType(dbId: string) {
  const { error } = await supabase.from('garment_types').delete().eq('id', dbId);
  if (error) throw error;
}

async function updateGarmentFields(dbId: string, fields: MeasurementField[]) {
  const { data, error } = await supabase
    .from('garment_types')
    .update({ fields })
    .eq('id', dbId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGarmentType(data as GarmentTypeRow);
}

export async function addGarmentSizeField(dbId: string, field: MeasurementField) {
  const { data: row, error: fetchError } = await supabase
    .from('garment_types')
    .select('fields')
    .eq('id', dbId)
    .single();

  if (fetchError) throw fetchError;

  const fields = parseMeasurementFields(row.fields);
  if (fields.some((item) => item.id === field.id)) {
    throw new Error('A size field with this name already exists');
  }

  fields.push(field);
  return updateGarmentFields(dbId, fields);
}

export async function removeGarmentSizeField(dbId: string, fieldId: string) {
  const { data: row, error: fetchError } = await supabase
    .from('garment_types')
    .select('fields')
    .eq('id', dbId)
    .single();

  if (fetchError) throw fetchError;

  const fields = parseMeasurementFields(row.fields).filter((item) => item.id !== fieldId);
  return updateGarmentFields(dbId, fields);
}

export async function updateGarmentSizeField(
  dbId: string,
  fieldId: string,
  next: MeasurementField,
) {
  const { data: row, error: fetchError } = await supabase
    .from('garment_types')
    .select('fields')
    .eq('id', dbId)
    .single();

  if (fetchError) throw fetchError;

  const fields = parseMeasurementFields(row.fields);
  const index = fields.findIndex((item) => item.id === fieldId);
  if (index < 0) {
    throw new Error('Size field not found');
  }

  fields[index] = { ...next, id: fieldId };
  return updateGarmentFields(dbId, fields);
}

export function fieldKeyFromLabel(label: string) {
  const base = slugify(label);
  return base || `field_${Date.now()}`;
}

import { supabase, isSupabaseConfigured } from './supabase';
import { resolveShopUserId } from './shop-user';
import {
  GARMENT_CATALOG,
  normalizeMeasurementFields,
  type GarmentGender,
  type GarmentType,
  type MeasurementField,
} from './garments';
import { parseStaffRates } from './staff-jobs';
import type { Json } from '../types/database';

type GarmentTypeRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  gender: string;
  fields: unknown;
  sort_order: number;
  staff_rates?: unknown;
};

function parseMeasurementFields(value: unknown): MeasurementField[] {
  return normalizeMeasurementFields(value);
}

function unpackGarmentFields(value: unknown): {
  fields: MeasurementField[];
  staffRates: Record<string, number>;
} {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ('fields' in record || 'staffRates' in record) {
      return {
        fields: parseMeasurementFields(record.fields),
        staffRates: parseStaffRates(record.staffRates),
      };
    }
  }
  return {
    fields: parseMeasurementFields(value),
    staffRates: {},
  };
}

function packGarmentFields(fields: MeasurementField[], staffRates: Record<string, number>): Json {
  if (Object.keys(staffRates).length === 0) return fields as unknown as Json;
  return { fields, staffRates } as unknown as Json;
}

function mergeStaffRates(...parts: Array<Record<string, number> | undefined>) {
  return Object.assign({}, ...parts.filter(Boolean));
}

function rowToGarmentType(row: GarmentTypeRow): GarmentType {
  const packed = unpackGarmentFields(row.fields);
  return {
    id: row.slug,
    dbId: row.id,
    label: row.label,
    gender: row.gender === 'female' ? 'female' : 'male',
    fields: packed.fields,
    staffRates: mergeStaffRates(packed.staffRates, parseStaffRates(row.staff_rates)),
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
    staff_rates: garment.staffRates ?? {},
    sort_order: index,
  }));

  const { error } = await supabase.from('garment_types').insert(rows);
  if (error && /staff_rates/i.test(error.message)) {
    const stripped = rows.map(({ staff_rates: rates, ...rest }) => ({
      ...rest,
      fields: packGarmentFields(rest.fields ?? [], parseStaffRates(rates)),
    }));
    const retry = await supabase.from('garment_types').insert(stripped);
    if (retry.error) throw retry.error;
    return true;
  }
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
  staffRates?: Record<string, number>;
}) {
  const userId = await resolveShopUserId();
  if (!userId) throw new Error('Shop user not configured');

  const slug = await uniqueSlug(input.label, input.gender);
  const row = {
    user_id: userId,
    slug,
    label: input.label.trim(),
    gender: input.gender,
    fields: packGarmentFields(input.fields ?? [], input.staffRates ?? {}),
    sort_order: await nextGarmentSortOrder(),
    staff_rates: input.staffRates ?? {},
  };
  const first = await supabase.from('garment_types').insert(row).select('*').single();
  if (first.error && /staff_rates/i.test(first.error.message)) {
    const { staff_rates: _rates, ...rest } = row;
    const retry = await supabase
      .from('garment_types')
      .insert({
        ...rest,
        fields: packGarmentFields(input.fields ?? [], input.staffRates ?? {}),
      })
      .select('*')
      .single();
    if (retry.error) throw retry.error;
    return rowToGarmentType(retry.data as GarmentTypeRow);
  }
  if (first.error) throw first.error;
  return rowToGarmentType(first.data as GarmentTypeRow);
}

export async function updateGarmentType(
  dbId: string,
  input: {
    label?: string;
    gender?: GarmentGender;
    fields?: MeasurementField[];
    staffRates?: Record<string, number>;
  },
) {
  const current = await supabase.from('garment_types').select('fields').eq('id', dbId).single();
  if (current.error) throw current.error;
  const packed = unpackGarmentFields(current.data.fields);
  const nextFields = input.fields ?? packed.fields;
  const nextRates = input.staffRates ?? packed.staffRates;

  const update: {
    label?: string;
    gender?: GarmentGender;
    fields?: Json;
    slug?: string;
    staff_rates?: Record<string, number>;
  } = {};

  if (input.label !== undefined) update.label = input.label.trim();
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.fields !== undefined || input.staffRates !== undefined) {
    update.fields = packGarmentFields(nextFields, nextRates);
  }
  if (input.staffRates !== undefined) update.staff_rates = input.staffRates;

  if (input.label && input.gender) {
    update.slug = await uniqueSlug(input.label, input.gender, dbId);
  }

  const { data, error } = await supabase
    .from('garment_types')
    .update(update)
    .eq('id', dbId)
    .select('*')
    .single();

  if (error && /staff_rates/i.test(error.message)) {
    const { staff_rates: _rates, ...rest } = update;
    const retry = await supabase.from('garment_types').update(rest).eq('id', dbId).select('*').single();
    if (retry.error) throw retry.error;
    return rowToGarmentType(retry.data as GarmentTypeRow);
  }

  if (error) throw error;
  return rowToGarmentType(data as GarmentTypeRow);
}

export async function deleteGarmentType(dbId: string) {
  const { error } = await supabase.from('garment_types').delete().eq('id', dbId);
  if (error) throw error;
}

async function updateGarmentFields(dbId: string, fields: MeasurementField[]) {
  const { data: row, error: fetchError } = await supabase
    .from('garment_types')
    .select('fields')
    .eq('id', dbId)
    .single();
  if (fetchError) throw fetchError;
  const packed = unpackGarmentFields(row.fields);
  const { data, error } = await supabase
    .from('garment_types')
    .update({ fields: packGarmentFields(fields, packed.staffRates) })
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

  const packed = unpackGarmentFields(row.fields);
  if (packed.fields.some((item) => item.id === field.id)) {
    throw new Error('A size field with this name already exists');
  }

  return updateGarmentFields(dbId, [...packed.fields, field]);
}

export async function removeGarmentSizeField(dbId: string, fieldId: string) {
  const { data: row, error: fetchError } = await supabase
    .from('garment_types')
    .select('fields')
    .eq('id', dbId)
    .single();

  if (fetchError) throw fetchError;

  const packed = unpackGarmentFields(row.fields);
  return updateGarmentFields(
    dbId,
    packed.fields.filter((item) => item.id !== fieldId),
  );
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

  const packed = unpackGarmentFields(row.fields);
  const index = packed.fields.findIndex((item) => item.id === fieldId);
  if (index < 0) {
    throw new Error('Size field not found');
  }

  packed.fields[index] = { ...next, id: fieldId };
  return updateGarmentFields(dbId, packed.fields);
}

export function fieldKeyFromLabel(label: string) {
  const base = slugify(label);
  return base || `field_${Date.now()}`;
}

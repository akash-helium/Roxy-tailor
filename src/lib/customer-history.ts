import type { Cloth } from '../types';
import { getGarmentType } from './garments';

export type KnownCustomer = {
  name: string;
  phone: string;
  updatedAt: string;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function normalizePhone(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function customerMatches(cloth: Cloth, name: string, phone?: string | null) {
  const wantedName = normalizeName(name);
  if (!wantedName) return false;
  if (normalizeName(cloth.customerName) !== wantedName) return false;

  const wantedPhone = normalizePhone(phone);
  if (!wantedPhone) return true;
  const clothPhone = normalizePhone(cloth.customerPhone);
  if (!clothPhone) return true;
  return clothPhone === wantedPhone;
}

function clothTime(cloth: Cloth) {
  return cloth.updatedAt || cloth.createdAt || '';
}

export function listKnownCustomers(cloths: Cloth[]): KnownCustomer[] {
  const byName = new Map<string, KnownCustomer>();

  for (const cloth of cloths) {
    const key = normalizeName(cloth.customerName);
    if (!key) continue;
    const next: KnownCustomer = {
      name: cloth.customerName.trim(),
      phone: cloth.customerPhone?.trim() ?? '',
      updatedAt: clothTime(cloth),
    };
    const existing = byName.get(key);
    if (!existing || next.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byName.set(key, next);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function findKnownCustomer(cloths: Cloth[], name: string): KnownCustomer | null {
  const key = normalizeName(name);
  if (!key) return null;
  return listKnownCustomers(cloths).find((customer) => normalizeName(customer.name) === key) ?? null;
}

export function findCustomerByPhone(cloths: Cloth[], phone: string): KnownCustomer | null {
  const wanted = normalizePhone(phone);
  if (wanted.length !== 10) return null;
  return (
    listKnownCustomers(cloths).find((customer) => normalizePhone(customer.phone) === wanted) ?? null
  );
}

function sameGarment(cloth: Cloth, garmentType: string) {
  if (!garmentType) return false;
  if (cloth.garmentType && cloth.garmentType === garmentType) return true;
  const type = getGarmentType(garmentType);
  if (!type) return false;
  const haystack = `${cloth.garmentType} ${cloth.garment}`.toLowerCase();
  return haystack.includes(type.label.toLowerCase()) || haystack.includes(type.id.toLowerCase());
}

export type RememberedSizing = {
  gender: Cloth['gender'];
  measurements: Record<string, string>;
};

export function latestSizingForCustomer(
  cloths: Cloth[],
  name: string,
  phone: string,
  garmentType: string,
): RememberedSizing | null {
  if (!normalizeName(name) || !garmentType) return null;

  const match = cloths
    .filter((cloth) => customerMatches(cloth, name, phone) && sameGarment(cloth, garmentType))
    .sort((a, b) => clothTime(b).localeCompare(clothTime(a)))[0];

  if (!match) return null;

  const measurements = { ...(match.measurements ?? {}) };
  const hasValue = Object.values(measurements).some((value) => String(value ?? '').trim());
  if (!hasValue && !match.size?.trim()) return null;

  return {
    gender: match.gender === 'female' ? 'female' : 'male',
    measurements,
  };
}

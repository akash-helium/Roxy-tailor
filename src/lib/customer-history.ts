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

export function normalizePhone(phone?: string | null) {
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
  const byKey = new Map<string, KnownCustomer>();

  for (const cloth of cloths) {
    const name = cloth.customerName.trim();
    const phone = normalizePhone(cloth.customerPhone);
    if (!name && phone.length !== 10) continue;
    const key = phone.length === 10 ? `p:${phone}` : `n:${normalizeName(name)}`;
    const next: KnownCustomer = {
      name: name || cloth.customerName.trim(),
      phone: phone.length === 10 ? phone : cloth.customerPhone?.trim() ?? '',
      updatedAt: clothTime(cloth),
    };
    const existing = byKey.get(key);
    if (!existing || next.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byKey.set(key, next);
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function suggestCustomersByPhone(cloths: Cloth[], phoneQuery: string): KnownCustomer[] {
  const digits = phoneQuery.replace(/\D/g, '');
  if (digits.length < 3) return [];
  return listKnownCustomers(cloths)
    .filter((customer) => normalizePhone(customer.phone).includes(digits))
    .slice(0, 8);
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
  const wantedPhone = normalizePhone(phone);
  const wantedName = normalizeName(name);
  if ((!wantedName && wantedPhone.length !== 10) || !garmentType) return null;

  const match = cloths
    .filter((cloth) => {
      if (!sameGarment(cloth, garmentType)) return false;
      if (wantedPhone.length === 10 && normalizePhone(cloth.customerPhone) === wantedPhone) {
        return true;
      }
      return wantedName ? customerMatches(cloth, name, phone) : false;
    })
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

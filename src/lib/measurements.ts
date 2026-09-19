import { getGarmentType, isMeasurementOn, measurementFieldType } from './garments';
import type { Cloth, DatedAmount } from '../types';
import type { Json } from '../types/database';

export type MeasurementData = {
  garmentType: string;
  gender: 'male' | 'female';
  measurements: Record<string, string>;
  inGroup: boolean;
};

export function inGroupToStorage(inGroup: boolean) {
  return { inGroup };
}

export function formatMeasurementsSummary(
  garmentTypeId: string | null,
  measurements: Record<string, string>,
) {
  const garment = getGarmentType(garmentTypeId);
  if (!garment) {
    const filled = Object.values(measurements).filter((v) => v.trim());
    return filled.length > 0 ? filled.join(', ') : '';
  }

  const parts = garment.fields
    .map((field) => {
      const value = measurements[field.id]?.trim();
      if (!value) return null;
      const kind = measurementFieldType(field);
      if (kind === 'boolean') {
        return isMeasurementOn(value) ? field.label : null;
      }
      if (kind === 'select') {
        const option = field.options?.find((item) => item.id === value || item.label === value);
        return `${field.label}: ${option?.label ?? value}`;
      }
      return `${field.label} ${value}"`;
    })
    .filter(Boolean);

  return parts.join(' · ');
}

export function clothSizeSummary(cloth: Pick<Cloth, 'garmentType' | 'measurements' | 'size'>) {
  const fromMeasurements = formatMeasurementsSummary(cloth.garmentType, cloth.measurements ?? {});
  if (fromMeasurements) return fromMeasurements;
  return cloth.size?.trim() ?? '';
}

export function parseJsonRecord<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as T;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function normalizeDatedAmount(value: unknown): DatedAmount | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { amount: value, date: '' };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { amount?: unknown; date?: unknown };
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      amount,
      date: typeof record.date === 'string' ? record.date : '',
    };
  }
  return null;
}

export function parseDatedAmounts(value: unknown): DatedAmount[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeDatedAmount)
    .filter((item): item is DatedAmount => Boolean(item));
}

export function parseMeasurementChecks(value: unknown): {
  inGroup: boolean;
  partPayments: DatedAmount[];
  advanceDate: string;
  finalPaymentDate: string;
  deliveryDate: string;
} {
  const record = parseJsonRecord<Record<string, unknown>>(value, {});
  return {
    inGroup: Boolean(record.inGroup),
    partPayments: parseDatedAmounts(record.partPayments),
    advanceDate: typeof record.advanceDate === 'string' ? record.advanceDate : '',
    finalPaymentDate: typeof record.finalPaymentDate === 'string' ? record.finalPaymentDate : '',
    deliveryDate: typeof record.deliveryDate === 'string' ? record.deliveryDate : '',
  };
}

export function measurementChecksPayload(input: {
  inGroup: boolean;
  partPayments?: DatedAmount[];
  advanceDate?: string | null;
  finalPaymentDate?: string | null;
  deliveryDate?: string | null;
}): Json {
  return {
    inGroup: input.inGroup,
    partPayments: input.partPayments ?? [],
    advanceDate: input.advanceDate?.trim() || '',
    finalPaymentDate: input.finalPaymentDate?.trim() || '',
    deliveryDate: input.deliveryDate?.trim() || '',
  } as unknown as Json;
}

export function parseInGroup(value: unknown) {
  return parseMeasurementChecks(value).inGroup;
}

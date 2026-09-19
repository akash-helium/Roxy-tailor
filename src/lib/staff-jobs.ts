import type { Cloth, ClothStaffJob, StaffType } from '../types';
import { getGarmentType } from './garments';

export function parseStaffRates(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const rates: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const amount = Number(raw);
    if (key && Number.isFinite(amount) && amount >= 0) rates[key] = amount;
  }
  return rates;
}

export function parseClothStaffJobs(value: unknown): ClothStaffJob[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const type = String(record.type ?? '').trim();
      const staffId = String(record.staffId ?? record.staff_id ?? '').trim();
      if (!type || !staffId) return null;
      return {
        type,
        staffId,
        amount: Number(record.amount) || 0,
        advance: Number(record.advance) || 0,
        final: Number(record.final) || 0,
        remarks: typeof record.remarks === 'string' ? record.remarks : '',
      } satisfies ClothStaffJob;
    })
    .filter((item): item is ClothStaffJob => Boolean(item));
}

export function staffRateForGarment(garmentTypeId: string | null | undefined, staffType: string) {
  const garment = getGarmentType(garmentTypeId);
  const rate = garment?.staffRates?.[staffType];
  return Number.isFinite(rate) && (rate ?? 0) >= 0 ? Number(rate) : 0;
}

export function emptyStaffJob(type: string, staffId: string, amount = 0): ClothStaffJob {
  return { type, staffId, amount, advance: 0, final: 0, remarks: '' };
}

export function jobsFromLegacyColumns(cloth: Pick<
  Cloth,
  | 'cutterId'
  | 'tailorId'
  | 'cutterPayAmount'
  | 'cutterPayAdvance'
  | 'cutterPayFinal'
  | 'cutterPayRemarks'
  | 'tailorPayAmount'
  | 'tailorPayAdvance'
  | 'tailorPayFinal'
  | 'tailorPayRemarks'
  | 'staffJobs'
>): ClothStaffJob[] {
  const byType = new Map<string, ClothStaffJob>();
  for (const job of cloth.staffJobs ?? []) {
    byType.set(job.type, job);
  }
  if (cloth.cutterId) {
    const existing = byType.get('cutter');
    byType.set('cutter', {
      type: 'cutter',
      staffId: cloth.cutterId,
      amount: existing?.amount || cloth.cutterPayAmount || 0,
      advance: existing?.advance || cloth.cutterPayAdvance || 0,
      final: existing?.final || cloth.cutterPayFinal || 0,
      remarks: existing?.remarks || cloth.cutterPayRemarks || '',
    });
  }
  if (cloth.tailorId) {
    const existing = byType.get('tailor');
    byType.set('tailor', {
      type: 'tailor',
      staffId: cloth.tailorId,
      amount: existing?.amount || cloth.tailorPayAmount || 0,
      advance: existing?.advance || cloth.tailorPayAdvance || 0,
      final: existing?.final || cloth.tailorPayFinal || 0,
      remarks: existing?.remarks || cloth.tailorPayRemarks || '',
    });
  }
  return [...byType.values()];
}

export function upsertStaffJob(
  jobs: ClothStaffJob[],
  next: { type: string; staffId: string | null; amount?: number; advance?: number; final?: number; remarks?: string },
) {
  const remaining = jobs.filter((job) => job.type !== next.type);
  if (!next.staffId) return remaining;
  const existing = jobs.find((job) => job.type === next.type);
  remaining.push({
    type: next.type,
    staffId: next.staffId,
    amount: next.amount ?? existing?.amount ?? 0,
    advance: next.advance ?? existing?.advance ?? 0,
    final: next.final ?? existing?.final ?? 0,
    remarks: next.remarks ?? existing?.remarks ?? '',
  });
  return remaining;
}

export function applyLegacyPayColumns(jobs: ClothStaffJob[]) {
  const cutter = jobs.find((job) => job.type === 'cutter');
  const tailor = jobs.find((job) => job.type === 'tailor');
  return {
    cutterId: cutter?.staffId ?? null,
    tailorId: tailor?.staffId ?? null,
    cutterPayAmount: cutter?.amount ?? 0,
    cutterPayAdvance: cutter?.advance ?? 0,
    cutterPayFinal: cutter?.final ?? 0,
    cutterPayRemarks: cutter?.remarks ?? '',
    tailorPayAmount: tailor?.amount ?? 0,
    tailorPayAdvance: tailor?.advance ?? 0,
    tailorPayFinal: tailor?.final ?? 0,
    tailorPayRemarks: tailor?.remarks ?? '',
    staffJobs: jobs,
  };
}

export function jobForStaff(cloth: Cloth, staffId: string, staffType: StaffType): ClothStaffJob | null {
  return (
    jobsFromLegacyColumns(cloth).find((job) => job.staffId === staffId && job.type === staffType) ??
    jobsFromLegacyColumns(cloth).find((job) => job.staffId === staffId) ??
    null
  );
}

export function clothsForStaff(staffId: string, cloths: Cloth[]) {
  return cloths.filter((cloth) => jobsFromLegacyColumns(cloth).some((job) => job.staffId === staffId));
}

export function markJobsPaid(jobs: ClothStaffJob[], clothIds: Set<string>, clothId: string) {
  if (!clothIds.has(clothId)) return jobs;
  return jobs.map((job) => ({ ...job, final: job.amount, advance: job.advance }));
}

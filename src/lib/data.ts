import { barcodeLookupCandidates } from "./barcode";
import * as local from "./local-store";
import * as remote from "./db";
import {
  jobsFromLegacyColumns,
  staffRateForGarment,
  upsertStaffJob,
} from "./staff-jobs";
import {
  resolveReadStorageMode,
  resolveWriteStorageMode,
} from "./storage-mode";
import {
  filterCloths,
  countClothsByStatus,
  CLOTH_PAGE_SIZE,
  type ClothStatusFilter,
} from "./cloth-list";
import type { Cloth, ClothStaffJob, DatedAmount, Staff, StaffPayout, StaffType } from "../types";

export type { Cloth } from "../types";
export {
  fetchClothStatusCounts as fetchRemoteClothStatusCounts,
  fetchClothsPage as fetchRemoteClothsPage,
} from "./db";

export async function getWriteStorageMode() {
  return resolveWriteStorageMode();
}

export async function addStaff(input: {
  name: string;
  type: StaffType;
  phone: string;
  notes: string;
}) {
  const mode = await resolveWriteStorageMode();
  return mode === "local" ? local.addStaffLocal(input) : remote.addStaff(input);
}

export async function removeStaff(id: string) {
  const mode = await resolveWriteStorageMode();
  return mode === "local" ? local.removeStaffLocal(id) : remote.removeStaff(id);
}

export async function updateStaffPayouts(id: string, payouts: StaffPayout[]) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateStaffPayoutsLocal(id, payouts)
    : remote.updateStaffPayouts(id, payouts);
}

export async function deleteCloths(ids: string[]) {
  if (ids.length === 0) return;
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.deleteClothsLocal(ids)
    : remote.deleteCloths(ids);
}

export async function registerCloth(input: {
  customerName: string;
  customerPhone?: string;
  garment: string;
  garmentType: string;
  gender: "male" | "female";
  fabricColor: string;
  size: string;
  measurements: Record<string, string>;
  inGroup: boolean;
  notes: string;
  cutterId: string | null;
  tailorId?: string | null;
  totalAmount: number;
  discountAmount: number;
  advanceAmount: number;
  givenDate: string | null;
  deliveryDate?: string | null;
  cutterExpectedDate: string | null;
  tailorExpectedDate?: string | null;
  cutterPayAmount?: number;
  tailorPayAmount?: number;
  code?: string;
  orderBatchId?: string;
  staffJobs?: ClothStaffJob[];
}) {
  const created = await registerClothOrder([input]);
  return created[0]!;
}

export async function registerClothOrder(
  inputs: {
    customerName: string;
    customerPhone?: string;
    garment: string;
    garmentType: string;
    gender: "male" | "female";
    fabricColor: string;
    size: string;
    measurements: Record<string, string>;
    inGroup: boolean;
    notes: string;
    cutterId: string | null;
    tailorId?: string | null;
    totalAmount: number;
    discountAmount: number;
    advanceAmount: number;
    givenDate: string | null;
    deliveryDate?: string | null;
    cutterExpectedDate: string | null;
    tailorExpectedDate?: string | null;
    cutterPayAmount?: number;
    tailorPayAmount?: number;
    code?: string;
    orderBatchId?: string;
    staffJobs?: import("../types").ClothStaffJob[];
  }[],
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.registerClothOrderLocal(inputs)
    : remote.registerClothOrder(inputs);
}

export async function adjustClothQuantity(
  cloth: Cloth,
  group: Cloth[],
  quantity: number,
) {
  const qty = Math.min(50, Math.max(1, Math.floor(Number(quantity))));
  const current = Math.max(1, group.length);
  if (!Number.isFinite(qty) || qty === current) return;

  if (qty < current) {
    const others = group.filter((item) => item.id !== cloth.id);
    await deleteCloths(others.slice(qty - 1).map((item) => item.id));
    return;
  }

  const extras = qty - current;
  const payload = {
    customerName: cloth.customerName,
    customerPhone: cloth.customerPhone,
    garment: cloth.garment,
    garmentType: cloth.garmentType,
    gender: cloth.gender,
    fabricColor: cloth.fabricColor,
    size: cloth.size,
    measurements: cloth.measurements,
    inGroup: cloth.inGroup,
    notes: cloth.notes,
    cutterId: cloth.cutterId,
    tailorId: cloth.tailorId,
    totalAmount: cloth.totalAmount,
    discountAmount: cloth.discountAmount,
    advanceAmount: cloth.advanceAmount,
    givenDate: cloth.givenDate,
    deliveryDate: cloth.deliveryDate,
    cutterExpectedDate: cloth.cutterExpectedDate,
    tailorExpectedDate: cloth.tailorExpectedDate,
    cutterPayAmount: cloth.cutterPayAmount,
    tailorPayAmount: cloth.tailorPayAmount,
    orderBatchId: cloth.orderBatchId || undefined,
    staffJobs: cloth.staffJobs ?? [],
  };

  await registerClothOrder(Array.from({ length: extras }, () => payload));
}

export async function updateClothMeasurements(
  id: string,
  input: {
    garment: string;
    garmentType: string;
    gender: "male" | "female";
    size: string;
    measurements: Record<string, string>;
    inGroup: boolean;
  },
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothMeasurementsLocal(id, input)
    : remote.updateClothMeasurements(id, input);
}

export async function updateClothSize(id: string, size: string) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothSizeLocal(id, size)
    : remote.updateClothSize(id, size);
}

export async function updateClothPayments(
  id: string,
  input: {
    totalAmount: number;
    discountAmount: number;
    advanceAmount: number;
    advanceDate?: string | null;
    partPayments: DatedAmount[];
    finalPaymentAmount: number;
    finalPaymentDate?: string | null;
  },
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothPaymentsLocal(id, input)
    : remote.updateClothPayments(id, input);
}

export async function updateClothStaffPayments(
  id: string,
  input: Parameters<typeof local.updateClothStaffPaymentsLocal>[1],
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothStaffPaymentsLocal(id, input)
    : remote.updateClothStaffPayments(id, input);
}

export async function updateClothCustomerPhone(ids: string[], customerPhone: string) {
  if (ids.length === 0) return;
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothCustomerPhoneLocal(ids, customerPhone)
    : remote.updateClothCustomerPhone(ids, customerPhone);
}

export async function updateClothDates(
  id: string,
  input: {
    givenDate: string | null;
    deliveryDate?: string | null;
    cutterExpectedDate: string | null;
    tailorExpectedDate: string | null;
  },
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.updateClothDatesLocal(id, input)
    : remote.updateClothDates(id, input);
}

export async function getClothByCode(code: string) {
  const mode = await resolveReadStorageMode();
  for (const candidate of barcodeLookupCandidates(code)) {
    const cloth =
      mode === "local"
        ? local.getClothByCodeLocal(candidate)
        : await remote.getClothByCode(candidate);
    if (cloth) return cloth;
  }
  return null;
}

export async function markCuttingComplete(id: string) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.markCuttingCompleteLocal(id)
    : remote.markCuttingComplete(id);
}

export async function writeStaffJobs(id: string, jobs: ClothStaffJob[]) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.writeStaffJobsLocal(id, jobs)
    : remote.writeStaffJobs(id, jobs);
}

async function applyAssignmentPay(
  cloth: Cloth | null,
  type: string,
  staffId: string | null,
) {
  if (!cloth) return cloth;
  const jobs = jobsFromLegacyColumns(cloth);
  const existing = jobs.find((job) => job.type === type);
  const amount = staffId
    ? existing?.staffId === staffId && existing.amount > 0
      ? existing.amount
      : staffRateForGarment(cloth.garmentType, type) || existing?.amount || 0
    : 0;
  const next = upsertStaffJob(jobs, { type, staffId, amount });
  return writeStaffJobs(cloth.id, next);
}

export async function assignCutter(
  id: string,
  cutterId: string | null,
  cutterExpectedDate?: string | null,
) {
  const mode = await resolveWriteStorageMode();
  const assigned =
    mode === "local"
      ? local.assignCutterLocal(id, cutterId, cutterExpectedDate)
      : await remote.assignCutter(id, cutterId, cutterExpectedDate);
  return applyAssignmentPay(assigned, "cutter", cutterId);
}

export async function assignTailor(
  id: string,
  tailorId: string | null,
  tailorExpectedDate: string | null,
  options?: { startSewing?: boolean },
) {
  const mode = await resolveWriteStorageMode();
  const assigned =
    mode === "local"
      ? local.assignTailorLocal(id, tailorId, tailorExpectedDate, options)
      : await remote.assignTailor(id, tailorId, tailorExpectedDate, options);
  return applyAssignmentPay(assigned, "tailor", tailorId);
}

export async function assignStaffJob(
  cloth: Cloth,
  type: string,
  staffId: string | null,
) {
  if (type === "cutter") return assignCutter(cloth.id, staffId);
  if (type === "tailor") {
    return assignTailor(cloth.id, staffId, cloth.tailorExpectedDate ?? null, {
      startSewing: (cloth.status === "ready_to_sew" || cloth.status === "sewing") && Boolean(staffId),
    });
  }
  return applyAssignmentPay(cloth, type, staffId);
}

export async function markSewingComplete(id: string) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.markSewingCompleteLocal(id)
    : remote.markSewingComplete(id);
}

export async function setClothDone(id: string, done: boolean) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.setClothDoneLocal(id, done)
    : remote.setClothDone(id, done);
}

export function getStaffById(staff: Staff[], id: string | null) {
  return local.getStaffByIdLocal(staff, id);
}

export function getStaffByType<T extends { type: StaffType }>(
  staff: T[],
  type: StaffType,
) {
  return local.getStaffByTypeLocal(staff, type);
}

export async function fetchClothsPage(options: {
  page: number;
  pageSize?: number;
  status?: ClothStatusFilter;
  search?: string;
}) {
  const mode = await resolveReadStorageMode();
  if (mode === "local") {
    const all = local.getLocalSnapshot().cloths;
    const filtered = filterCloths(
      all,
      options.status ?? "all",
      options.search ?? "",
    );
    const pageSize = options.pageSize ?? CLOTH_PAGE_SIZE;
    const from = options.page * pageSize;
    return {
      cloths: filtered.slice(from, from + pageSize),
      total: filtered.length,
    };
  }
  return remote.fetchClothsPage(options);
}

export async function fetchClothStatusCounts() {
  const mode = await resolveReadStorageMode();
  if (mode === "local") {
    return countClothsByStatus(local.getLocalSnapshot().cloths);
  }
  return remote.fetchClothStatusCounts();
}

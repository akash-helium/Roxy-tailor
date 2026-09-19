import { barcodeLookupCandidates } from "./barcode";
import * as local from "./local-store";
import * as remote from "./db";
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
import type { DatedAmount, Staff, StaffPayout, StaffType } from "../types";

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
  }[],
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.registerClothOrderLocal(inputs)
    : remote.registerClothOrder(inputs);
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

export async function assignCutter(
  id: string,
  cutterId: string | null,
  cutterExpectedDate?: string | null,
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.assignCutterLocal(id, cutterId, cutterExpectedDate)
    : remote.assignCutter(id, cutterId, cutterExpectedDate);
}

export async function assignTailor(
  id: string,
  tailorId: string | null,
  tailorExpectedDate: string | null,
  options?: { startSewing?: boolean },
) {
  const mode = await resolveWriteStorageMode();
  return mode === "local"
    ? local.assignTailorLocal(id, tailorId, tailorExpectedDate, options)
    : remote.assignTailor(id, tailorId, tailorExpectedDate, options);
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

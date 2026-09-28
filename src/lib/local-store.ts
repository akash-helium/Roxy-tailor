import type { AppData, Cloth, ClothStatus, DatedAmount, Staff, StaffPayout, StaffType } from "../types";
import { generateId, nextClothCodes, generateOrderCode } from "./utils";
import { collectedOrderCodes } from "./customer-order";
import { parseDatedAmounts } from "./measurements";
import { parseClothStaffJobs, applyLegacyPayColumns, jobsFromLegacyColumns } from "./staff-jobs";
import { parseStaffPayouts, splitStaffNotes } from "./staff-payouts";

const STORAGE_KEY = "tailor-app-data";

const emptyData: AppData = { staff: [], cloths: [] };

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...emptyData };
    const data = JSON.parse(raw) as AppData;
    return {
      ...data,
      staff: (data.staff ?? []).map((member) => {
        const fromNotes = splitStaffNotes(member.notes);
        return {
          ...member,
          notes: fromNotes.notes,
          payouts:
            Array.isArray(member.payouts) && member.payouts.length > 0
              ? parseStaffPayouts(member.payouts)
              : fromNotes.payouts,
        };
      }),
      cloths: (data.cloths ?? []).map((cloth) => ({
        ...cloth,
        size: cloth.size ?? "",
        garmentType: cloth.garmentType ?? "",
        gender: cloth.gender === "female" ? "female" : "male",
        measurements: cloth.measurements ?? {},
        inGroup:
          cloth.inGroup ??
          Boolean(
            (cloth as { measurementChecks?: { inGroup?: boolean } })
              .measurementChecks?.inGroup,
          ),
        orderBatchId:
          cloth.orderBatchId ??
          (cloth as { measurementChecks?: { orderBatchId?: string } })
            .measurementChecks?.orderBatchId ??
          "",
        orderCode:
          cloth.orderCode ??
          (cloth as { measurementChecks?: { orderCode?: string } })
            .measurementChecks?.orderCode ??
          "",
        totalAmount: cloth.totalAmount ?? 0,
        discountAmount: cloth.discountAmount ?? 0,
        advanceAmount: cloth.advanceAmount ?? 0,
        advanceDate: cloth.advanceDate ?? null,
        partPayments: parseDatedAmounts(cloth.partPayments),
        finalPaymentAmount: cloth.finalPaymentAmount ?? 0,
        finalPaymentDate: cloth.finalPaymentDate ?? null,
        cutterPayAmount: cloth.cutterPayAmount ?? 0,
        cutterPayAdvance: cloth.cutterPayAdvance ?? 0,
        cutterPayFinal: cloth.cutterPayFinal ?? 0,
        cutterPayRemarks: cloth.cutterPayRemarks ?? "",
        tailorPayAmount: cloth.tailorPayAmount ?? 0,
        tailorPayAdvance: cloth.tailorPayAdvance ?? 0,
        tailorPayFinal: cloth.tailorPayFinal ?? 0,
        tailorPayRemarks: cloth.tailorPayRemarks ?? "",
        customerPhone: cloth.customerPhone ?? "",
        givenDate: cloth.givenDate ?? null,
        deliveryDate: cloth.deliveryDate ?? null,
        cutterExpectedDate:
          cloth.cutterExpectedDate ??
          (cloth as { expectedDate?: string | null }).expectedDate ??
          null,
        tailorExpectedDate: cloth.tailorExpectedDate ?? null,
        staffJobs: jobsFromLegacyColumns({
          ...cloth,
          cutterId: cloth.cutterId ?? null,
          tailorId: cloth.tailorId ?? null,
          cutterPayAmount: cloth.cutterPayAmount ?? 0,
          cutterPayAdvance: cloth.cutterPayAdvance ?? 0,
          cutterPayFinal: cloth.cutterPayFinal ?? 0,
          cutterPayRemarks: cloth.cutterPayRemarks ?? "",
          tailorPayAmount: cloth.tailorPayAmount ?? 0,
          tailorPayAdvance: cloth.tailorPayAdvance ?? 0,
          tailorPayFinal: cloth.tailorPayFinal ?? 0,
          tailorPayRemarks: cloth.tailorPayRemarks ?? "",
          staffJobs: parseClothStaffJobs(cloth.staffJobs),
        }),
      })),
    };
  } catch {
    return { ...emptyData };
  }
}

function write(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  listeners.forEach((listener) => listener());
}

export function subscribeLocal(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocalSnapshot(): AppData {
  return read();
}

export function addStaffLocal(input: {
  name: string;
  type: StaffType;
  phone: string;
  notes: string;
}) {
  const data = read();
  const staff: Staff = { id: generateId(), ...input, payouts: [] };
  write({ ...data, staff: [staff, ...data.staff] });
  return staff;
}

export function updateStaffPayoutsLocal(id: string, payouts: StaffPayout[]) {
  const data = read();
  const staff = data.staff.map((member) =>
    member.id === id ? { ...member, payouts } : member,
  );
  write({ ...data, staff });
  return staff.find((member) => member.id === id) ?? null;
}

export function removeStaffLocal(id: string) {
  const data = read();
  write({
    staff: data.staff.filter((member) => member.id !== id),
    cloths: data.cloths,
  });
}

export function deleteClothsLocal(ids: string[]) {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const data = read();
  write({
    staff: data.staff,
    cloths: data.cloths.filter((cloth) => !idSet.has(cloth.id)),
  });
}

export function registerClothLocal(input: {
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
}) {
  return registerClothOrderLocal([input])[0]!;
}

export function registerClothOrderLocal(
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
    orderCode?: string;
    staffJobs?: import("../types").ClothStaffJob[];
  }[],
) {
  if (inputs.length === 0) return [];

  const data = read();
  const now = new Date().toISOString();
  const usedCodes = [...new Set(data.cloths.map((item) => item.code))];
  const generated = nextClothCodes(usedCodes, inputs.length);
  const orderCode =
    inputs.find((input) => input.orderCode?.trim())?.orderCode?.trim() ||
    generateOrderCode(collectedOrderCodes(data.cloths));

  const created: Cloth[] = inputs.map((input, index) => {
    const cloth: Cloth = {
      id: generateId(),
      code: input.code?.trim() || generated[index]!,
      customerName: input.customerName,
      customerPhone: input.customerPhone?.trim() ?? "",
      garment: input.garment,
      garmentType: input.garmentType,
      gender: input.gender,
      fabricColor: input.fabricColor,
      size: input.size,
      measurements: input.measurements,
      inGroup: input.inGroup,
      orderBatchId: input.orderBatchId?.trim() || "",
      orderCode: input.orderCode?.trim() || orderCode,
      notes: input.notes,
      status: "cutting",
      cutterId: input.cutterId || null,
      tailorId: input.tailorId || null,
      totalAmount: input.totalAmount,
      discountAmount: input.discountAmount,
      advanceAmount: input.advanceAmount,
      advanceDate: input.advanceAmount > 0 ? input.givenDate : null,
      partPayments: [],
      finalPaymentAmount: 0,
      finalPaymentDate: null,
      cutterPayAmount: input.cutterPayAmount ?? 0,
      cutterPayAdvance: 0,
      cutterPayFinal: 0,
      cutterPayRemarks: "",
      tailorPayAmount: input.tailorPayAmount ?? 0,
      tailorPayAdvance: 0,
      tailorPayFinal: 0,
      tailorPayRemarks: "",
      givenDate: input.givenDate,
      deliveryDate: input.deliveryDate?.trim() || null,
      cutterExpectedDate: input.cutterExpectedDate,
      tailorExpectedDate: input.tailorExpectedDate || null,
      staffJobs: jobsFromLegacyColumns({
        cutterId: input.cutterId || null,
        tailorId: input.tailorId || null,
        cutterPayAmount: input.cutterPayAmount ?? 0,
        cutterPayAdvance: 0,
        cutterPayFinal: 0,
        cutterPayRemarks: "",
        tailorPayAmount: input.tailorPayAmount ?? 0,
        tailorPayAdvance: 0,
        tailorPayFinal: 0,
        tailorPayRemarks: "",
        staffJobs: input.staffJobs ?? [],
      }),
      createdAt: now,
      updatedAt: now,
    };
    return cloth;
  });

  write({ ...data, cloths: [...created, ...data.cloths] });
  return created;
}

export function updateClothPaymentsLocal(
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
  return updateClothLocal(id, input);
}

export function updateClothStaffPaymentsLocal(
  id: string,
  input: Partial<
    Pick<
      Cloth,
      | "cutterId"
      | "tailorId"
      | "cutterPayAmount"
      | "cutterPayAdvance"
      | "cutterPayFinal"
      | "cutterPayRemarks"
      | "tailorPayAmount"
      | "tailorPayAdvance"
      | "tailorPayFinal"
      | "tailorPayRemarks"
      | "staffJobs"
    >
  >,
) {
  return updateClothLocal(id, input);
}

export function writeStaffJobsLocal(id: string, jobs: Cloth["staffJobs"]) {
  return updateClothLocal(id, applyLegacyPayColumns(jobs));
}

export function updateClothCustomerPhoneLocal(ids: string[], customerPhone: string) {
  for (const id of ids) updateClothLocal(id, { customerPhone });
}

export function updateClothDatesLocal(
  id: string,
  input: {
    givenDate: string | null;
    deliveryDate?: string | null;
    cutterExpectedDate: string | null;
    tailorExpectedDate: string | null;
  },
) {
  return updateClothLocal(id, input);
}

export function updateClothMeasurementsLocal(
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
  return updateClothLocal(id, input);
}

export function updateClothSizeLocal(id: string, size: string) {
  return updateClothLocal(id, { size });
}

export function updateClothNotesLocal(id: string, notes: string) {
  return updateClothLocal(id, { notes });
}

export function getClothByCodeLocal(code: string) {
  const normalized = code.trim().toUpperCase();
  const hyphenated =
    /^OR\d+$/i.test(normalized) ? `OR-${normalized.slice(2)}` : normalized;
  return (
    read().cloths.find((cloth) => cloth.code.toUpperCase() === normalized) ??
    read().cloths.find(
      (cloth) =>
        cloth.orderCode?.toUpperCase() === normalized ||
        cloth.orderCode?.toUpperCase() === hyphenated,
    ) ??
    null
  );
}

export function listClothsByOrderCodeLocal(code: string) {
  const normalized = code.trim().toUpperCase();
  const hyphenated =
    /^OR\d+$/i.test(normalized) ? `OR-${normalized.slice(2)}` : normalized;
  const matches = read().cloths.filter(
    (cloth) =>
      cloth.orderCode?.toUpperCase() === normalized ||
      cloth.orderCode?.toUpperCase() === hyphenated,
  );
  return matches.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.code.localeCompare(b.code),
  );
}

function updateClothLocal(id: string, patch: Partial<Cloth>) {
  const data = read();
  const cloths = data.cloths.map((cloth) =>
    cloth.id === id
      ? { ...cloth, ...patch, updatedAt: new Date().toISOString() }
      : cloth,
  );
  write({ ...data, cloths });
  return cloths.find((cloth) => cloth.id === id) ?? null;
}

export function markCuttingCompleteLocal(id: string) {
  const cloth = read().cloths.find((item) => item.id === id);
  if (!cloth) return null;
  return updateClothLocal(id, {
    status: (cloth.tailorId ? "sewing" : "ready_to_sew") satisfies ClothStatus,
  });
}

export function assignCutterLocal(
  id: string,
  cutterId: string | null,
  cutterExpectedDate?: string | null,
) {
  const patch: Partial<Cloth> = { cutterId };
  if (cutterExpectedDate !== undefined) {
    patch.cutterExpectedDate = cutterExpectedDate;
  }
  return updateClothLocal(id, patch);
}

export function assignTailorLocal(
  id: string,
  tailorId: string | null,
  tailorExpectedDate: string | null,
  options?: { startSewing?: boolean },
) {
  const startSewing = options?.startSewing ?? true;
  const patch: Partial<Cloth> = {
    tailorId,
    tailorExpectedDate,
  };
  if (startSewing && tailorId) {
    patch.status = "sewing" satisfies ClothStatus;
  }
  return updateClothLocal(id, patch);
}

export function markSewingCompleteLocal(id: string) {
  return updateClothLocal(id, { status: "completed" satisfies ClothStatus });
}

export function setClothDoneLocal(id: string, done: boolean) {
  const data = read();
  const cloth = data.cloths.find((item) => item.id === id);
  if (!cloth) return null;

  if (done) {
    return updateClothLocal(id, { status: "completed" satisfies ClothStatus });
  }

  let status: ClothStatus = "cutting";
  if (cloth.tailorId) {
    status = "sewing";
  } else if (cloth.cutterId) {
    status = "ready_to_sew";
  }

  return updateClothLocal(id, { status });
}

export function getStaffByIdLocal(staff: Staff[], id: string | null) {
  if (!id) return null;
  return staff.find((member) => member.id === id) ?? null;
}

export function getStaffByTypeLocal<T extends { type: StaffType }>(
  staff: T[],
  type: StaffType,
) {
  return staff.filter((member) => member.type === type);
}

export function exportLocalData() {
  return read();
}

export function importLocalData(data: AppData, options?: { silent?: boolean }) {
  if (options?.silent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return;
  }
  write(data);
}

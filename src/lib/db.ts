import { supabase } from "./supabase";
import { mapCloth, mapStaff } from "./mappers";
import { nextClothCodes, generateOrderCode } from "./utils";
import { collectedOrderCodes } from "./customer-order";
import type { Cloth, ClothStaffJob, StaffType } from "../types";
import { escapeIlike, CLOTH_PAGE_SIZE, clothSearchTokens } from "./cloth-list";
import type { ClothStatusFilter } from "./cloth-list";

import type { Database, Json } from "../types/database";

type ClothUpdate = Database["public"]["Tables"]["cloths"]["Update"];

type StaffPayPatch = Partial<
  Pick<
    Cloth,
    | "cutterPayAmount"
    | "cutterPayAdvance"
    | "cutterPayFinal"
    | "cutterPayRemarks"
    | "tailorPayAmount"
    | "tailorPayAdvance"
    | "tailorPayFinal"
    | "tailorPayRemarks"
  >
>;

function staffPayPatchToRow(patch: StaffPayPatch): ClothUpdate {
  const row: ClothUpdate = {};
  if (patch.cutterPayAmount !== undefined)
    row.cutter_pay_amount = patch.cutterPayAmount;
  if (patch.cutterPayAdvance !== undefined)
    row.cutter_pay_advance = patch.cutterPayAdvance;
  if (patch.cutterPayFinal !== undefined)
    row.cutter_pay_final = patch.cutterPayFinal;
  if (patch.cutterPayRemarks !== undefined)
    row.cutter_pay_remarks = patch.cutterPayRemarks;
  if (patch.tailorPayAmount !== undefined)
    row.tailor_pay_amount = patch.tailorPayAmount;
  if (patch.tailorPayAdvance !== undefined)
    row.tailor_pay_advance = patch.tailorPayAdvance;
  if (patch.tailorPayFinal !== undefined)
    row.tailor_pay_final = patch.tailorPayFinal;
  if (patch.tailorPayRemarks !== undefined)
    row.tailor_pay_remarks = patch.tailorPayRemarks;
  return row;
}

import { resolveShopUserId } from "./shop-user";
import { parseMeasurementChecks, measurementChecksPayload } from "./measurements";
import { applyLegacyPayColumns } from "./staff-jobs";
import { joinStaffNotes, splitStaffNotes } from "./staff-payouts";
import type { DatedAmount, StaffPayout } from "../types";

async function requireUserId() {
  const userId = await resolveShopUserId();
  if (!userId) {
    throw new Error("You must be logged in.");
  }
  return userId;
}

async function readMeasurementChecks(id: string) {
  const { data, error } = await supabase
    .from("cloths")
    .select("measurement_checks")
    .eq("id", id)
    .single();
  if (error) throw error;
  return parseMeasurementChecks(data.measurement_checks);
}

export async function fetchStaff() {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapStaff);
}

export async function fetchCloths() {
  const { data, error } = await supabase
    .from("cloths")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapCloth);
}

export async function fetchClothStatusCounts() {
  const { data, error } = await supabase.from("cloths").select("status");
  if (error) throw error;

  const counts = {
    total: 0,
    cutting: 0,
    ready: 0,
    sewing: 0,
    completed: 0,
  };

  for (const row of data ?? []) {
    counts.total += 1;
    if (row.status === "cutting") counts.cutting += 1;
    else if (row.status === "ready_to_sew") counts.ready += 1;
    else if (row.status === "sewing") counts.sewing += 1;
    else if (row.status === "completed") counts.completed += 1;
  }

  return counts;
}

function buildClothSearchOr(
  search: string,
  options: { orderCode: boolean; phone: boolean },
) {
  const tokens = clothSearchTokens(search);
  const fields = ["code", "customer_name", "garment", "fabric_color", "size"];
  if (options.orderCode) fields.push("order_code");
  fields.push("measurement_checks->>orderCode");
  if (options.phone) fields.push("customer_phone");
  fields.push("measurement_checks->>customerPhone");
  return tokens
    .flatMap((token) => {
      const pattern = `%${escapeIlike(token)}%`;
      return fields.map((field) => `${field}.ilike.${pattern}`);
    })
    .join(",");
}

export async function fetchClothsPage(options: {
  page: number;
  pageSize?: number;
  status?: ClothStatusFilter;
  search?: string;
}) {
  const pageSize = options.pageSize ?? CLOTH_PAGE_SIZE;
  const from = options.page * pageSize;
  const to = from + pageSize - 1;
  const search = options.search?.trim();
  const searchWithAll = search ? buildClothSearchOr(search, { orderCode: true, phone: true }) : "";
  const searchWithoutOrderCode = search
    ? buildClothSearchOr(search, { orderCode: false, phone: true })
    : "";
  const searchWithoutPhone = search
    ? buildClothSearchOr(search, { orderCode: true, phone: false })
    : "";
  const searchBare = search ? buildClothSearchOr(search, { orderCode: false, phone: false }) : "";

  async function run(orFilter: string) {
    let query = supabase.from("cloths").select("*", { count: "exact" });
    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }
    if (orFilter) query = query.or(orFilter);
    return query.order("updated_at", { ascending: false }).range(from, to);
  }

  let result = await run(searchWithAll);
  if (result.error && search && isMissingOrderCodeColumn(result.error)) {
    result = await run(searchWithoutOrderCode);
  }
  if (result.error && search && isMissingCustomerPhoneColumn(result.error)) {
    result = await run(searchWithoutPhone);
  }
  if (result.error && search && (isMissingOrderCodeColumn(result.error) || isMissingCustomerPhoneColumn(result.error))) {
    result = await run(searchBare);
  }
  if (result.error) throw result.error;

  return {
    cloths: (result.data ?? []).map(mapCloth),
    total: result.count ?? 0,
  };
}

export async function addStaff(input: {
  name: string;
  type: StaffType;
  phone: string;
  notes: string;
}) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("staff")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      phone: input.phone,
      notes: input.notes,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapStaff(data);
}

function isMissingStaffPayoutsColumn(error: { message?: string } | null) {
  return Boolean(error?.message && /payouts/i.test(error.message));
}

export async function updateStaffPayouts(id: string, payouts: StaffPayout[]) {
  const current = await supabase.from("staff").select("notes").eq("id", id).single();
  if (current.error) throw current.error;
  const { notes } = splitStaffNotes(current.data?.notes ?? "");

  const withColumn = await supabase
    .from("staff")
    .update({ payouts: payouts as unknown as Json, notes })
    .eq("id", id)
    .select("*")
    .single();

  if (!withColumn.error) return mapStaff(withColumn.data);

  if (!isMissingStaffPayoutsColumn(withColumn.error)) throw withColumn.error;

  const fallback = await supabase
    .from("staff")
    .update({ notes: joinStaffNotes(notes, payouts) })
    .eq("id", id)
    .select("*")
    .single();
  if (fallback.error) throw fallback.error;
  return mapStaff(fallback.data);
}

export async function removeStaff(id: string) {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCloths(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("cloths").delete().in("id", ids);
  if (error) throw error;
}

export type RegisterClothInput = {
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
};

function toClothInsertRow(
  userId: string,
  input: RegisterClothInput,
  code: string,
) {
  return {
    user_id: userId,
    code,
    customer_name: input.customerName,
    customer_phone: input.customerPhone?.trim() ?? "",
    garment: input.garment,
    garment_type: input.garmentType,
    gender: input.gender,
    fabric_color: input.fabricColor,
    size: input.size,
    measurements: input.measurements,
    measurement_checks: measurementChecksPayload({
      inGroup: input.inGroup,
      partPayments: [],
      advanceDate: input.advanceAmount > 0 ? input.givenDate : '',
      finalPaymentDate: '',
      deliveryDate: input.deliveryDate,
      orderBatchId: input.orderBatchId,
      orderCode: input.orderCode,
      staffJobs: input.staffJobs ?? [],
      customerPhone: input.customerPhone,
    }),
    staff_jobs: (input.staffJobs ?? []) as unknown as Json,
    measurement_image: null,
    notes: input.notes,
    status: "cutting" as const,
    cutter_id: input.cutterId || null,
    tailor_id: input.tailorId || null,
    total_amount: input.totalAmount,
    discount_amount: input.discountAmount,
    advance_amount: input.advanceAmount,
    final_payment_amount: 0,
    cutter_pay_amount: input.cutterPayAmount ?? 0,
    cutter_pay_advance: 0,
    cutter_pay_final: 0,
    cutter_pay_remarks: "",
    tailor_pay_amount: input.tailorPayAmount ?? 0,
    tailor_pay_advance: 0,
    tailor_pay_final: 0,
    tailor_pay_remarks: "",
    given_date: input.givenDate,
    cutter_expected_date: input.cutterExpectedDate,
    tailor_expected_date: input.tailorExpectedDate || null,
    order_code: input.orderCode?.trim() || "",
  };
}

function isMissingCustomerPhoneColumn(error: { message?: string } | null) {
  return Boolean(error?.message && /customer_phone/i.test(error.message));
}

function isMissingStaffJobsColumn(error: { message?: string } | null) {
  return Boolean(error?.message && /staff_jobs/i.test(error.message));
}

function isMissingOrderCodeColumn(error: { message?: string } | null) {
  return Boolean(error?.message && /order_code/i.test(error.message));
}

function withoutKey(rows: Record<string, unknown>[], key: string) {
  return rows.map((row) => {
    const next = { ...row };
    delete next[key];
    return next;
  });
}

async function insertClothRows(rows: ReturnType<typeof toClothInsertRow>[]) {
  let current: Record<string, unknown>[] = rows as Record<string, unknown>[];
  let result = await supabase.from("cloths").insert(current as never).select("*");

  if (result.error && isMissingOrderCodeColumn(result.error)) {
    current = withoutKey(current, "order_code");
    result = await supabase.from("cloths").insert(current as never).select("*");
  }
  if (result.error && isMissingStaffJobsColumn(result.error)) {
    current = withoutKey(current, "staff_jobs");
    result = await supabase.from("cloths").insert(current as never).select("*");
  }
  if (result.error && isMissingCustomerPhoneColumn(result.error)) {
    current = withoutKey(current, "customer_phone");
    result = await supabase.from("cloths").insert(current as never).select("*");
  }
  return result;
}

export async function registerCloth(input: RegisterClothInput) {
  const [cloth] = await registerClothOrder([input]);
  if (!cloth) throw new Error("Failed to register cloth");
  return cloth;
}

/** Register one or more pieces in a single order. Each piece gets its own barcode. */
export async function registerClothOrder(inputs: RegisterClothInput[]) {
  if (inputs.length === 0) return [];

  const userId = await requireUserId();
  const existing = await fetchCloths();
  const usedCodes = [...new Set(existing.map((cloth) => cloth.code))];
  const generated = nextClothCodes(usedCodes, inputs.length);
  const orderCode =
    inputs.find((input) => input.orderCode?.trim())?.orderCode?.trim() ||
    generateOrderCode(collectedOrderCodes(existing));

  const rows = inputs.map((input, index) =>
    toClothInsertRow(
      userId,
      { ...input, orderCode: input.orderCode?.trim() || orderCode },
      input.code?.trim() || generated[index]!,
    ),
  );

  const inserted = await insertClothRows(rows);
  if (inserted.error) throw inserted.error;
  return (inserted.data ?? []).map(mapCloth);
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
  const checks = await readMeasurementChecks(id);
  const { data, error } = await supabase
    .from("cloths")
    .update({
      garment: input.garment,
      garment_type: input.garmentType,
      gender: input.gender,
      size: input.size,
      measurements: input.measurements,
      measurement_checks: measurementChecksPayload({
        ...checks,
        inGroup: input.inGroup,
      }),
      measurement_image: null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function updateClothNotes(id: string, notes: string) {
  const { data, error } = await supabase
    .from("cloths")
    .update({ notes })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function updateClothSize(id: string, size: string) {
  const { data, error } = await supabase
    .from("cloths")
    .update({ size })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function updateClothCustomerPhone(ids: string[], customerPhone: string) {
  if (ids.length === 0) return [];
  const first = await supabase
    .from("cloths")
    .update({ customer_phone: customerPhone })
    .in("id", ids)
    .select("*");
  if (!first.error) return (first.data ?? []).map(mapCloth);
  if (!isMissingCustomerPhoneColumn(first.error)) throw first.error;

  const updated: Cloth[] = [];
  for (const id of ids) {
    const checks = await readMeasurementChecks(id);
    const { data, error } = await supabase
      .from("cloths")
      .update({
        measurement_checks: measurementChecksPayload({ ...checks, customerPhone }),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    updated.push(mapCloth(data));
  }
  return updated;
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
  const checks = await readMeasurementChecks(id);
  const { data, error } = await supabase
    .from("cloths")
    .update({
      total_amount: input.totalAmount,
      discount_amount: input.discountAmount,
      advance_amount: input.advanceAmount,
      final_payment_amount: input.finalPaymentAmount,
      measurement_checks: measurementChecksPayload({
        ...checks,
        partPayments: input.partPayments,
        advanceDate: input.advanceDate ?? checks.advanceDate,
        finalPaymentDate: input.finalPaymentDate ?? checks.finalPaymentDate,
      }),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
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
  const checks = await readMeasurementChecks(id);
  const { data, error } = await supabase
    .from("cloths")
    .update({
      given_date: input.givenDate,
      cutter_expected_date: input.cutterExpectedDate,
      tailor_expected_date: input.tailorExpectedDate,
      measurement_checks: measurementChecksPayload({
        ...checks,
        deliveryDate: input.deliveryDate ?? checks.deliveryDate,
      }),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function updateClothStaffPayments(
  id: string,
  patch: StaffPayPatch,
) {
  const { data, error } = await supabase
    .from("cloths")
    .update(staffPayPatchToRow(patch))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function writeStaffJobs(id: string, jobs: ClothStaffJob[]) {
  const checks = await readMeasurementChecks(id);
  const columns = applyLegacyPayColumns(jobs);
  const row: ClothUpdate = {
    cutter_id: columns.cutterId,
    tailor_id: columns.tailorId,
    cutter_pay_amount: columns.cutterPayAmount,
    cutter_pay_advance: columns.cutterPayAdvance,
    cutter_pay_final: columns.cutterPayFinal,
    cutter_pay_remarks: columns.cutterPayRemarks,
    tailor_pay_amount: columns.tailorPayAmount,
    tailor_pay_advance: columns.tailorPayAdvance,
    tailor_pay_final: columns.tailorPayFinal,
    tailor_pay_remarks: columns.tailorPayRemarks,
    measurement_checks: measurementChecksPayload({
      ...checks,
      staffJobs: jobs,
    }),
    staff_jobs: jobs as unknown as Json,
  };
  const first = await supabase.from("cloths").update(row).eq("id", id).select("*").single();
  if (first.error && /staff_jobs/i.test(first.error.message)) {
    const { staff_jobs: _jobs, ...rest } = row;
    const retry = await supabase.from("cloths").update(rest).eq("id", id).select("*").single();
    if (retry.error) throw retry.error;
    return mapCloth(retry.data);
  }
  if (first.error) throw first.error;
  return mapCloth(first.data);
}

export async function getClothByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("cloths")
    .select("*")
    .ilike("code", normalized)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapCloth(data);

  if (/^OR-?\d+$/i.test(normalized)) {
    const hyphenated = normalized.includes("-")
      ? normalized
      : `OR-${normalized.slice(2)}`;
    const byColumn = await supabase
      .from("cloths")
      .select("*")
      .or(`order_code.eq.${hyphenated},order_code.eq.${normalized}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!byColumn.error && byColumn.data) return mapCloth(byColumn.data);

    const { data: byOrder, error: orderError } = await supabase
      .from("cloths")
      .select("*")
      .or(
        `measurement_checks->>orderCode.eq.${hyphenated},measurement_checks->>orderCode.eq.${normalized}`,
      )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;
    return byOrder ? mapCloth(byOrder) : null;
  }

  return null;
}

export async function listClothsByOrderCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^OR-?\d+$/i.test(normalized)) return [];
  const hyphenated = normalized.includes("-")
    ? normalized
    : `OR-${normalized.slice(2)}`;
  const byColumn = await supabase
    .from("cloths")
    .select("*")
    .or(`order_code.eq.${hyphenated},order_code.eq.${normalized}`)
    .order("created_at", { ascending: true });
  if (!byColumn.error && byColumn.data && byColumn.data.length > 0) {
    return byColumn.data.map(mapCloth);
  }
  const { data, error } = await supabase
    .from("cloths")
    .select("*")
    .or(
      `measurement_checks->>orderCode.eq.${hyphenated},measurement_checks->>orderCode.eq.${normalized}`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCloth);
}

export async function markCuttingComplete(id: string) {
  const { data: existing, error: fetchError } = await supabase
    .from("cloths")
    .select("tailor_id")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from("cloths")
    .update({ status: existing?.tailor_id ? "sewing" : "ready_to_sew" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function assignCutter(
  id: string,
  cutterId: string | null,
  cutterExpectedDate?: string | null,
) {
  const patch: {
    cutter_id: string | null;
    cutter_expected_date?: string | null;
  } = {
    cutter_id: cutterId,
  };
  if (cutterExpectedDate !== undefined) {
    patch.cutter_expected_date = cutterExpectedDate;
  }
  const { data, error } = await supabase
    .from("cloths")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function assignTailor(
  id: string,
  tailorId: string | null,
  tailorExpectedDate: string | null,
  options?: { startSewing?: boolean },
) {
  const startSewing = options?.startSewing ?? true;
  const patch: {
    tailor_id: string | null;
    tailor_expected_date: string | null;
    status?: "sewing";
  } = {
    tailor_id: tailorId,
    tailor_expected_date: tailorExpectedDate,
  };
  if (startSewing && tailorId) {
    patch.status = "sewing";
  }
  const { data, error } = await supabase
    .from("cloths")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function markSewingComplete(id: string) {
  const { data, error } = await supabase
    .from("cloths")
    .update({ status: "completed" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export async function setClothDone(id: string, done: boolean) {
  const { data: existing, error: fetchError } = await supabase
    .from("cloths")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  let status: Cloth["status"] = "cutting";
  if (done) {
    status = "completed";
  } else if (existing.tailor_id) {
    status = "sewing";
  } else if (existing.cutter_id) {
    status = "ready_to_sew";
  }

  const { data, error } = await supabase
    .from("cloths")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCloth(data);
}

export function getStaffById(
  staff: { id: string; name: string }[],
  id: string | null,
) {
  if (!id) return null;
  return staff.find((member) => member.id === id) ?? null;
}

export function getStaffByType<T extends { type: StaffType }>(
  staff: T[],
  type: StaffType,
) {
  return staff.filter((member) => member.type === type);
}

export function getClothCounts(cloths: Cloth[]) {
  return {
    total: cloths.length,
    cutting: cloths.filter((c) => c.status === "cutting").length,
    ready: cloths.filter((c) => c.status === "ready_to_sew").length,
    sewing: cloths.filter((c) => c.status === "sewing").length,
    completed: cloths.filter((c) => c.status === "completed").length,
  };
}

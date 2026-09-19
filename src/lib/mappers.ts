import type { Cloth, ClothStatus, Staff, StaffType } from '../types';
import type { Database } from '../types/database';
import { parseJsonRecord, parseMeasurementChecks } from './measurements';
import { parseStaffPayouts, splitStaffNotes } from './staff-payouts';

type StaffRow = Database['public']['Tables']['staff']['Row'] & { payouts?: unknown };
type ClothRow = Database['public']['Tables']['cloths']['Row'];

export function mapStaff(row: StaffRow): Staff {
  const fromNotes = splitStaffNotes(row.notes);
  const fromColumn = parseStaffPayouts(row.payouts);
  return {
    id: row.id,
    name: row.name,
    type: row.type as StaffType,
    phone: row.phone,
    notes: fromNotes.notes,
    payouts: fromColumn.length > 0 ? fromColumn : fromNotes.payouts,
  };
}

export function mapCloth(row: ClothRow): Cloth {
  const checks = parseMeasurementChecks(row.measurement_checks);
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? '',
    garment: row.garment,
    garmentType: row.garment_type ?? '',
    gender: (row.gender === 'female' ? 'female' : 'male') as Cloth['gender'],
    fabricColor: row.fabric_color,
    size: row.size ?? '',
    measurements: parseJsonRecord<Record<string, string>>(row.measurements, {}),
    inGroup: checks.inGroup,
    notes: row.notes,
    status: row.status as ClothStatus,
    cutterId: row.cutter_id,
    tailorId: row.tailor_id,
    totalAmount: Number(row.total_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    advanceAmount: Number(row.advance_amount ?? 0),
    advanceDate: checks.advanceDate || null,
    partPayments: checks.partPayments,
    finalPaymentAmount: Number(row.final_payment_amount ?? 0),
    finalPaymentDate: checks.finalPaymentDate || null,
    cutterPayAmount: Number(row.cutter_pay_amount ?? 0),
    cutterPayAdvance: Number(row.cutter_pay_advance ?? 0),
    cutterPayFinal: Number(row.cutter_pay_final ?? 0),
    cutterPayRemarks: row.cutter_pay_remarks ?? '',
    tailorPayAmount: Number(row.tailor_pay_amount ?? 0),
    tailorPayAdvance: Number(row.tailor_pay_advance ?? 0),
    tailorPayFinal: Number(row.tailor_pay_final ?? 0),
    tailorPayRemarks: row.tailor_pay_remarks ?? '',
    givenDate: row.given_date ?? null,
    deliveryDate: checks.deliveryDate || null,
    cutterExpectedDate: row.cutter_expected_date ?? row.expected_date ?? null,
    tailorExpectedDate: row.tailor_expected_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


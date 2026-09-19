import * as remote from './db';
import { exportLocalData, importLocalData } from './local-store';
import { supabase } from './supabase';
import { resolveShopUserId } from './shop-user';
import type { Cloth, Staff } from '../types';
import { joinStaffNotes } from './staff-payouts';
import { measurementChecksPayload } from './measurements';

const SYNC_FLAG = 'tailor-local-synced';

export function hasSyncedLocalData() {
  return localStorage.getItem(SYNC_FLAG) === '1';
}

function markSynced() {
  localStorage.setItem(SYNC_FLAG, '1');
}

function staffRow(staff: Staff, userId: string) {
  return {
    id: staff.id,
    user_id: userId,
    name: staff.name,
    type: staff.type,
    phone: staff.phone,
    notes: joinStaffNotes(staff.notes, staff.payouts ?? []),
  };
}

function clothRow(cloth: Cloth, userId: string) {
  return {
    id: cloth.id,
    user_id: userId,
    code: cloth.code,
    customer_name: cloth.customerName,
    garment: cloth.garment,
    garment_type: cloth.garmentType ?? '',
    gender: cloth.gender ?? 'male',
    fabric_color: cloth.fabricColor,
    size: cloth.size,
    measurements: cloth.measurements ?? {},
    measurement_checks: measurementChecksPayload({
      inGroup: cloth.inGroup ?? false,
      partPayments: cloth.partPayments ?? [],
      advanceDate: cloth.advanceDate,
      finalPaymentDate: cloth.finalPaymentDate,
      deliveryDate: cloth.deliveryDate,
    }),
    measurement_image: null,
    notes: cloth.notes,
    status: cloth.status,
    cutter_id: cloth.cutterId,
    tailor_id: cloth.tailorId,
    total_amount: cloth.totalAmount,
    discount_amount: cloth.discountAmount ?? 0,
    advance_amount: cloth.advanceAmount,
    final_payment_amount: cloth.finalPaymentAmount,
    cutter_pay_amount: cloth.cutterPayAmount,
    cutter_pay_advance: cloth.cutterPayAdvance,
    cutter_pay_final: cloth.cutterPayFinal,
    cutter_pay_remarks: cloth.cutterPayRemarks,
    tailor_pay_amount: cloth.tailorPayAmount,
    tailor_pay_advance: cloth.tailorPayAdvance,
    tailor_pay_final: cloth.tailorPayFinal,
    tailor_pay_remarks: cloth.tailorPayRemarks,
    given_date: cloth.givenDate,
    cutter_expected_date: cloth.cutterExpectedDate,
    tailor_expected_date: cloth.tailorExpectedDate,
    created_at: cloth.createdAt,
    updated_at: cloth.updatedAt,
  };
}

export async function syncLocalDataToRemote() {
  const snapshot = exportLocalData();
  if (snapshot.staff.length === 0 && snapshot.cloths.length === 0) {
    return { synced: false, reason: 'empty' as const };
  }

  const userId = await resolveShopUserId();
  if (!userId) {
    return { synced: false, reason: 'no-shop-user' as const };
  }

  const { count: remoteStaff } = await supabase
    .from('staff')
    .select('id', { count: 'exact', head: true });
  const { count: remoteCloths } = await supabase
    .from('cloths')
    .select('id', { count: 'exact', head: true });
  const remoteEmpty = (remoteStaff ?? 0) === 0 && (remoteCloths ?? 0) === 0;

  if (hasSyncedLocalData() && !remoteEmpty) {
    return { synced: false, reason: 'already-synced' as const };
  }

  if (snapshot.staff.length > 0) {
    const { error } = await supabase
      .from('staff')
      .upsert(snapshot.staff.map((member) => staffRow(member, userId)), { onConflict: 'id' });
    if (error) throw new Error(`Staff sync failed: ${error.message}`);
  }

  if (snapshot.cloths.length > 0) {
    const { error } = await supabase
      .from('cloths')
      .upsert(snapshot.cloths.map((cloth) => clothRow(cloth, userId)), { onConflict: 'id' });
    if (error) {
      throw new Error(
        `Cloth sync failed: ${error.message}. Run supabase/upgrade-schema.sql in Supabase SQL Editor.`,
      );
    }
  }

  markSynced();
  return { synced: true, staff: snapshot.staff.length, cloths: snapshot.cloths.length };
}

/** Download latest Supabase data into phone local storage (keeps app in sync with admin). */
export async function pullRemoteDataToLocal() {
  const userId = await resolveShopUserId();
  if (!userId) {
    return { pulled: false, reason: 'no-shop-user' as const };
  }

  const [staff, cloths] = await Promise.all([remote.fetchStaff(), remote.fetchCloths()]);
  importLocalData({ staff, cloths }, { silent: true });
  return { pulled: true, staff: staff.length, cloths: cloths.length };
}

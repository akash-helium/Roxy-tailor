import type { Cloth, Staff } from '../types';
import { todayDateString } from './utils';

export type ShopStageFilter = 'all' | 'cutting' | 'unassigned' | 'tailoring' | 'done';

function dayKey(value: string | null | undefined) {
  return (value ?? '').slice(0, 10);
}

export function clothIsUnassigned(cloth: Pick<Cloth, 'status' | 'cutterId' | 'tailorId'>) {
  if (cloth.status === 'cutting') return !cloth.cutterId;
  if (cloth.status === 'ready_to_sew') return true;
  if (cloth.status === 'sewing') return !cloth.tailorId;
  return false;
}

export function clothMatchesShopStage(cloth: Cloth, stage: ShopStageFilter) {
  if (stage === 'all') return true;
  if (stage === 'unassigned') return clothIsUnassigned(cloth);
  if (stage === 'cutting') return cloth.status === 'cutting';
  if (stage === 'tailoring') return cloth.status === 'sewing' || cloth.status === 'ready_to_sew';
  return cloth.status === 'completed';
}

export function clothMatchesShopDate(cloth: Cloth, date: string) {
  const day = date.trim().slice(0, 10);
  if (!day) return true;
  return dayKey(cloth.deliveryDate) === day || dayKey(cloth.givenDate) === day;
}

export function filterShopCloths(cloths: Cloth[], stage: ShopStageFilter, date: string) {
  return cloths.filter(
    (cloth) => clothMatchesShopStage(cloth, stage) && clothMatchesShopDate(cloth, date),
  );
}

export function calendarDayFromIso(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10)) && raw.length <= 10) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function clothDoneOnDay(cloth: Cloth, day: string) {
  return cloth.status === 'completed' && calendarDayFromIso(cloth.updatedAt) === day;
}

export function todayBoardCloths(cloths: Cloth[], day: string, today = todayDateString()) {
  const due: Cloth[] = [];
  const done: Cloth[] = [];
  const overdue: Cloth[] = [];
  const seen = new Set<string>();

  for (const cloth of cloths) {
    const delivery = dayKey(cloth.deliveryDate);
    const isDue = delivery === day && cloth.status !== 'completed';
    const isDone = clothDoneOnDay(cloth, day);
    const isOverdue = day === today && Boolean(delivery) && delivery < today && cloth.status !== 'completed';
    if (!isDue && !isDone && !isOverdue) continue;
    if (seen.has(cloth.id)) continue;
    seen.add(cloth.id);
    if (isOverdue) overdue.push(cloth);
    else if (isDue) due.push(cloth);
    else done.push(cloth);
  }

  return { due, done, overdue, pieces: [...overdue, ...due, ...done] };
}

export function overdueDeliverableCloths(cloths: Cloth[], today = todayDateString()) {
  return cloths.filter((cloth) => {
    const due = dayKey(cloth.deliveryDate);
    return Boolean(due) && due < today && cloth.status !== 'completed';
  });
}

export type ShopStaffLoad = {
  staffId: string;
  name: string;
  stage: 'Cutting' | 'Tailoring';
  count: number;
};

export function shopWorkCounts(cloths: Cloth[]) {
  let cutting = 0;
  let tailoring = 0;
  let ready = 0;
  let done = 0;
  let unassigned = 0;
  for (const cloth of cloths) {
    if (clothIsUnassigned(cloth)) unassigned += 1;
    if (cloth.status === 'cutting') cutting += 1;
    else if (cloth.status === 'sewing') tailoring += 1;
    else if (cloth.status === 'ready_to_sew') ready += 1;
    else if (cloth.status === 'completed') done += 1;
  }
  return { cutting, tailoring, ready, done, unassigned };
}

function bump(map: Map<string, number>, id: string) {
  map.set(id, (map.get(id) ?? 0) + 1);
}

export function shopStaffLoads(cloths: Cloth[], staff: Staff[]) {
  const names = new Map(staff.map((person) => [person.id, person.name]));
  const cutting = new Map<string, number>();
  const tailoring = new Map<string, number>();
  let unassignedCutting = 0;
  let ready = 0;

  for (const cloth of cloths) {
    if (cloth.status === 'cutting') {
      if (cloth.cutterId) bump(cutting, cloth.cutterId);
      else unassignedCutting += 1;
    } else if (cloth.status === 'sewing') {
      if (cloth.tailorId) bump(tailoring, cloth.tailorId);
      else ready += 1;
    } else if (cloth.status === 'ready_to_sew') {
      ready += 1;
    }
  }

  const rows: ShopStaffLoad[] = [];
  for (const [staffId, count] of cutting) {
    rows.push({
      staffId,
      name: names.get(staffId) || 'Cutter',
      stage: 'Cutting',
      count,
    });
  }
  for (const [staffId, count] of tailoring) {
    rows.push({
      staffId,
      name: names.get(staffId) || 'Tailor',
      stage: 'Tailoring',
      count,
    });
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { rows, unassignedCutting, ready };
}

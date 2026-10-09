import type { Cloth, Staff } from '../types';
import { getStaffCloths } from './payments';

export type StaffWorkBoard = 'pending' | 'working' | 'done';

/** Where this cloth sits for this staff member's job. */
export function staffClothBoard(staff: Staff, cloth: Cloth): StaffWorkBoard {
  if (staff.type === 'cutter') {
    return cloth.status === 'cutting' ? 'working' : 'done';
  }
  if (staff.type === 'tailor') {
    if (cloth.status === 'completed') return 'done';
    if (cloth.status === 'sewing') return 'working';
    return 'pending';
  }
  if (cloth.status === 'completed') return 'done';
  if (cloth.status === 'cutting' || cloth.status === 'sewing') return 'working';
  return 'pending';
}

export function staffWorkBoards(staff: Staff, cloths: Cloth[]) {
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  const pending: Cloth[] = [];
  const working: Cloth[] = [];
  const done: Cloth[] = [];
  for (const cloth of assigned) {
    const board = staffClothBoard(staff, cloth);
    if (board === 'pending') pending.push(cloth);
    else if (board === 'working') working.push(cloth);
    else done.push(cloth);
  }
  return { assigned, pending, working, done };
}

export function staffWorkBoardLabel(board: StaffWorkBoard, type: string) {
  if (board === 'working') {
    if (type === 'cutter') return 'Cutting now';
    if (type === 'tailor') return 'Stitching now';
    return 'Working now';
  }
  if (board === 'pending') {
    if (type === 'tailor') return 'Waiting (still with cutter)';
    return 'Pending';
  }
  if (type === 'cutter') return 'Cutting done';
  if (type === 'tailor') return 'Stitching done';
  return 'Done';
}

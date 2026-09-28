import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
  type Cloth,
  type ClothStatus,
} from '../types';
import { orderWorkflowStatus } from './customer-order';

const NEEDS_CUTTER = {
  label: 'Unassigned',
  className: 'border-slate-200 bg-slate-100 text-slate-600',
};

export function clothNeedsCutter(cloth: Pick<Cloth, 'status' | 'cutterId'>) {
  return cloth.status === 'cutting' && !cloth.cutterId;
}

function badgeForStatus(status: ClothStatus) {
  const key = status in CLOTH_STATUS_LABELS ? status : 'cutting';
  return {
    label: CLOTH_STATUS_LABELS[key],
    className: CLOTH_STATUS_COLORS[key],
  };
}

export function clothStageBadge(cloth: Pick<Cloth, 'status' | 'cutterId'>) {
  if (clothNeedsCutter(cloth)) return NEEDS_CUTTER;
  return badgeForStatus(cloth.status);
}

export function orderStageBadge(cloths: Cloth[]) {
  if (cloths.length === 0) return NEEDS_CUTTER;
  if (cloths.every(clothNeedsCutter)) return NEEDS_CUTTER;
  return badgeForStatus(orderWorkflowStatus(cloths));
}

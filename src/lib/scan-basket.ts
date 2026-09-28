import type { Cloth } from '../types';
import { getCustomerOrderCloths, groupClothsForStaffTickets } from './customer-order';
import { clothBillName } from './utils';

export type ScanBasketKind =
  | 'needs_cutter'
  | 'needs_tailor'
  | 'mark_cutting'
  | 'mark_sewing'
  | 'done';

export function looksLikeOrderCode(code: string) {
  return /^OR-?\d+$/i.test(code.trim());
}

/** Customer bill scan code — distinct from staff piece codes (CL-). */
export function customerBillScanCode(orderCode: string, fallbackPieceCode = '') {
  const inner = (orderCode || fallbackPieceCode)
    .trim()
    .toUpperCase()
    .replace(/^CU-?/, '');
  return inner ? `CU-${inner}` : '';
}

/** Inner order/piece code from a customer-bill scan, or null if this is not a customer bill. */
export function customerBillLookupCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact.startsWith('CU') || compact.length <= 2) return null;
  const rest = compact.slice(2);
  if (rest.startsWith('OR') && rest.length > 2) return `OR-${rest.slice(2)}`;
  if (rest.startsWith('CL') && rest.length > 2) return `CL-${rest.slice(2)}`;
  return rest;
}

export function classifyScanCloth(cloth: Pick<Cloth, 'status' | 'cutterId'>) {
  if (cloth.status === 'completed') return 'done' as const;
  if (cloth.status === 'cutting' && !cloth.cutterId) return 'needs_cutter' as const;
  if (cloth.status === 'cutting') return 'mark_cutting' as const;
  if (cloth.status === 'ready_to_sew') return 'needs_tailor' as const;
  if (cloth.status === 'sewing') return 'mark_sewing' as const;
  return 'done' as const;
}

export function expandScannedCloths(hit: Cloth, allCloths: Cloth[], scannedCode: string): Cloth[] {
  const order = getCustomerOrderCloths(hit, allCloths);
  if (looksLikeOrderCode(scannedCode)) {
    return order.length > 0 ? order : [hit];
  }
  const group = groupClothsForStaffTickets(order).find((items) =>
    items.some((item) => item.id === hit.id),
  );
  return group && group.length > 0 ? group : [hit];
}

export function mergeBasket(existing: Cloth[], incoming: Cloth[]) {
  const seen = new Set(existing.map((item) => item.id));
  const added: Cloth[] = [];
  const duplicates: Cloth[] = [];
  for (const cloth of incoming) {
    if (seen.has(cloth.id)) {
      duplicates.push(cloth);
      continue;
    }
    seen.add(cloth.id);
    added.push(cloth);
  }
  return {
    next: added.length > 0 ? [...existing, ...added] : existing,
    added,
    duplicates,
  };
}

export function splitBasket(cloths: Cloth[]) {
  const needsCutter: Cloth[] = [];
  const needsTailor: Cloth[] = [];
  const markCutting: Cloth[] = [];
  const markSewing: Cloth[] = [];
  const done: Cloth[] = [];
  for (const cloth of cloths) {
    const kind = classifyScanCloth(cloth);
    if (kind === 'needs_cutter') needsCutter.push(cloth);
    else if (kind === 'needs_tailor') needsTailor.push(cloth);
    else if (kind === 'mark_cutting') markCutting.push(cloth);
    else if (kind === 'mark_sewing') markSewing.push(cloth);
    else done.push(cloth);
  }
  return { needsCutter, needsTailor, markCutting, markSewing, done };
}

export function scanAddToast(added: Cloth[]) {
  if (added.length === 0) return '';
  const kinds = [...new Set(added.map((item) => classifyScanCloth(item)))];
  const first = added[0]!;
  const label = clothBillName(first);
  const code = first.code;
  if (added.length === 1) {
    if (kinds[0] === 'needs_cutter') return `Added to cutter · ${label} · ${code}`;
    if (kinds[0] === 'needs_tailor') return `Added to tailor · ${label} · ${code}`;
    if (kinds[0] === 'mark_cutting') return `Added to cutter · ${label} · ${code}`;
    if (kinds[0] === 'mark_sewing') return `Added to tailor · ${label} · ${code}`;
    return `Already done · ${label} · ${code}`;
  }
  if (kinds.length === 1 && kinds[0] === 'needs_cutter') {
    return `Added ${added.length} to cutter`;
  }
  if (kinds.length === 1 && kinds[0] === 'needs_tailor') {
    return `Added ${added.length} to tailor`;
  }
  return `Added ${added.length} tickets`;
}

export function sameStageAs(session: ScanBasketKind, cloth: Pick<Cloth, 'status' | 'cutterId'>) {
  return classifyScanCloth(cloth) === session;
}

export function otherStageMessage(session: ScanBasketKind, other: ScanBasketKind) {
  const cutterSide = session === 'needs_cutter' || session === 'mark_cutting';
  const otherCutter = other === 'needs_cutter' || other === 'mark_cutting';
  if (cutterSide && !otherCutter) return "That's tailor work. Finish this cutter list first.";
  if (!cutterSide && otherCutter) return "That's cutter work. Finish this tailor list first.";
  if (session === 'needs_cutter' && other === 'mark_cutting') {
    return "That's already with a cutter. Finish this unassigned list first.";
  }
  if (session === 'mark_cutting' && other === 'needs_cutter') {
    return "That's unassigned. Finish marking cutting done first.";
  }
  if (session === 'needs_tailor' && other === 'mark_sewing') {
    return "That's already with a tailor. Finish this ready-for-tailor list first.";
  }
  if (session === 'mark_sewing' && other === 'needs_tailor') {
    return "That's ready for tailor. Finish marking sewing done first.";
  }
  return 'Finish this list first.';
}

export function sessionModalTitle(kind: ScanBasketKind | null, count: number, code?: string) {
  if (count <= 1) return code ? `Order ${code}` : 'Scan Result';
  if (kind === 'needs_cutter') return `Assign cutter · ${count}`;
  if (kind === 'needs_tailor') return `Assign tailor · ${count}`;
  if (kind === 'mark_cutting') return `Mark cutting done · ${count}`;
  if (kind === 'mark_sewing') return `Mark sewing done · ${count}`;
  return `${count} scanned`;
}

export function applyScanToSession(
  existing: Cloth[],
  incoming: Cloth[],
  sessionKind: ScanBasketKind | null,
) {
  const skippedDone = incoming.filter((item) => classifyScanCloth(item) === 'done');
  const rest = incoming.filter((item) => classifyScanCloth(item) !== 'done');
  const kind = sessionKind ?? (rest[0] ? classifyScanCloth(rest[0]) : null);
  const matching = kind ? rest.filter((item) => classifyScanCloth(item) === kind) : rest;
  const mismatched = kind ? rest.filter((item) => classifyScanCloth(item) !== kind) : [];
  const merged = mergeBasket(existing, matching);
  return { ...merged, skippedDone, mismatched, sessionKind: kind };
}

export function refreshBasket(basket: Cloth[], allCloths: Cloth[]) {
  const byId = new Map(allCloths.map((item) => [item.id, item]));
  return basket
    .map((item) => byId.get(item.id))
    .filter((item): item is Cloth => Boolean(item));
}

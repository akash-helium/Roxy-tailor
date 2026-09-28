import type { Cloth } from '../types';
import {
  applyScanToSession,
  classifyScanCloth,
  expandScannedCloths,
  customerBillLookupCode,
  customerBillScanCode,
  looksLikeOrderCode,
  otherStageMessage,
  splitBasket,
} from './scan-basket';

function cloth(partial: Partial<Cloth> & Pick<Cloth, 'id' | 'code' | 'status'>): Cloth {
  return {
    customerName: 'Amina',
    customerPhone: '',
    garment: partial.garmentType ?? 'Coat',
    garmentType: 'Coat',
    gender: 'female',
    fabricColor: '',
    size: 'M',
    measurements: {},
    inGroup: true,
    orderBatchId: 'batch-1',
    orderCode: 'OR-007',
    staffJobs: [],
    notes: '',
    cutterId: null,
    tailorId: null,
    totalAmount: 0,
    discountAmount: 0,
    advanceAmount: 0,
    advanceDate: null,
    partPayments: [],
    finalPaymentAmount: 0,
    finalPaymentDate: null,
    cutterPayAmount: 0,
    cutterPayAdvance: 0,
    cutterPayFinal: 0,
    cutterPayRemarks: '',
    tailorPayAmount: 0,
    tailorPayAdvance: 0,
    tailorPayFinal: 0,
    tailorPayRemarks: '',
    givenDate: null,
    deliveryDate: null,
    cutterExpectedDate: null,
    tailorExpectedDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const unassigned = Array.from({ length: 10 }, (_, index) =>
  cloth({
    id: `u${index}`,
    code: `CL-${String(index + 1).padStart(3, '0')}`,
    garmentType: index % 2 === 0 ? 'Coat' : 'Jacket',
    status: 'cutting',
  }),
);

const ready = Array.from({ length: 10 }, (_, index) =>
  cloth({
    id: `r${index}`,
    code: `CL-${String(index + 40).padStart(3, '0')}`,
    status: 'ready_to_sew',
    cutterId: 'cutter-1',
  }),
);

const jacketPair = [
  cloth({ id: 'j1', code: 'CL-013', garmentType: 'Jacket', garment: 'Jacket', status: 'cutting' }),
  cloth({ id: 'j2', code: 'CL-013', garmentType: 'Jacket', garment: 'Jacket', status: 'cutting' }),
];

const tailorPiece = cloth({
  id: 't1',
  code: 'CL-012',
  status: 'sewing',
  cutterId: 'cutter-1',
  tailorId: 'tailor-1',
});

const donePiece = cloth({ id: 'd1', code: 'CL-099', status: 'completed', cutterId: 'c', tailorId: 't' });

assert(looksLikeOrderCode('OR-007') && looksLikeOrderCode('OR007'), 'order code pattern');
assert(!looksLikeOrderCode('CL-050'), 'cloth code is not an order code');

assert(classifyScanCloth({ status: 'cutting', cutterId: null }) === 'needs_cutter', 'unassigned → cutter');
assert(classifyScanCloth({ status: 'cutting', cutterId: 'c1' }) === 'mark_cutting', 'with cutter → mark cutting');
assert(classifyScanCloth({ status: 'ready_to_sew', cutterId: 'c1' }) === 'needs_tailor', 'ready → tailor');
assert(classifyScanCloth({ status: 'sewing', cutterId: 'c1' }) === 'mark_sewing', 'with tailor → mark sewing');
assert(classifyScanCloth({ status: 'completed', cutterId: 'c1' }) === 'done', 'completed → skip');

const orderHits = expandScannedCloths(unassigned[0]!, unassigned, 'OR-007');
assert(orderHits.length === 10, `OR-007 should expand to 10 pieces, got ${orderHits.length}`);

const qty2 = expandScannedCloths(jacketPair[0]!, [...unassigned, ...jacketPair], 'CL-013');
assert(qty2.length === 2 && qty2.every((item) => item.code === 'CL-013'), 'qty-2 staff ticket expands both jackets');

let basket = applyScanToSession([], unassigned, null);
assert(basket.next.length === 10, '10 unassigned land in basket');
assert(splitBasket(basket.next).needsCutter.length === 10, 'all 10 need cutter');
assert(splitBasket(basket.next).needsTailor.length === 0, 'unassigned must not appear in tailor');

const splitIds = splitBasket(basket.next).needsCutter.map((item) => item.id);
const batches = [splitIds.slice(0, 4), splitIds.slice(4, 7), splitIds.slice(7, 10)];
assert(
  batches.every((batch) => batch.length === 4 || batch.length === 3) &&
    batches[0]!.length === 4 &&
    batches[1]!.length === 3 &&
    batches[2]!.length === 3,
  '4/3/3 tick split',
);

const dupe = applyScanToSession(basket.next, [unassigned[0]!], 'needs_cutter');
assert(dupe.added.length === 0 && dupe.duplicates.length === 1, 'duplicate CL stays once');

const mixed = applyScanToSession(basket.next, [tailorPiece], 'needs_cutter');
assert(mixed.added.length === 0 && mixed.mismatched.length === 1, 'tailor-stage scan does not join cutter pile');
assert(
  otherStageMessage('needs_cutter', 'mark_sewing').includes('tailor work'),
  'mismatch toast names tailor work',
);
assert(splitBasket(mixed.next).needsCutter.length === 10, 'cutter pile unchanged');
assert(splitBasket(mixed.next).markSewing.length === 0, 'sewing ticket stays out of cutter session');

const reverse = applyScanToSession(ready, [unassigned[0]!], 'needs_tailor');
assert(reverse.mismatched.some((item) => item.id === 'u0'), 'unassigned is mismatch while collecting tailor');
assert(splitBasket(reverse.next).needsTailor.length === 10, 'ready pieces stay in tailor');

const skipped = applyScanToSession(basket.next, [donePiece], 'needs_cutter');
assert(skipped.added.length === 0 && skipped.skippedDone.length === 1, 'completed ticket skipped');

const readyBasket = applyScanToSession([], ready, null);
assert(splitBasket(readyBasket.next).needsTailor.length === 10, '10 ready_to_sew need tailor');
assert(splitBasket(readyBasket.next).needsCutter.length === 0, 'ready pieces are not cutter work');

assert(customerBillScanCode('OR-007') === 'CU-OR-007', 'customer bill code is prefixed');
assert(customerBillLookupCode('CU-OR-007') === 'OR-007', 'hyphenated customer bill parses');
assert(customerBillLookupCode('CUOR007') === 'OR-007', 'compact customer bill parses');
assert(customerBillLookupCode('CL-013') == null, 'staff piece is not a customer bill');
assert(looksLikeOrderCode('OR-007'), 'legacy customer bills still look like order codes');

console.log('scan-basket cases ok');

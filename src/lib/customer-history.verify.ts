import type { Cloth } from '../types';
import {
  findCustomerByPhone,
  latestSizingForCustomer,
  listCustomersByPhone,
  listKnownCustomers,
} from './customer-history';

function cloth(partial: Partial<Cloth> & Pick<Cloth, 'id' | 'customerName'>): Cloth {
  return {
    code: 'CL-001',
    status: 'cutting',
    customerPhone: '9876543210',
    garment: 'Shirt',
    garmentType: 'shirt',
    gender: 'male',
    fabricColor: '',
    size: '',
    measurements: { chest: '38' },
    inGroup: false,
    orderBatchId: '',
    orderCode: 'OR-001',
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

const family = [
  cloth({
    id: 'dad',
    customerName: 'Ramesh',
    measurements: { chest: '42' },
    updatedAt: '2026-02-01T00:00:00.000Z',
  }),
  cloth({
    id: 'son',
    customerName: 'Aarav',
    gender: 'male',
    measurements: { chest: '32' },
    updatedAt: '2026-03-01T00:00:00.000Z',
  }),
];

const people = listKnownCustomers(family);
assert(people.length === 2, `same number should keep two people, got ${people.length}`);
assert(
  listCustomersByPhone(family, '9876543210').map((item) => item.name).sort().join(',') === 'Aarav,Ramesh',
  'list both members on the number',
);
assert(findCustomerByPhone(family, '9876543210') === null, 'do not pick one person when two share a number');

const dadShirt = latestSizingForCustomer(family, 'Ramesh', '9876543210', 'shirt');
const sonShirt = latestSizingForCustomer(family, 'Aarav', '9876543210', 'shirt');
assert(dadShirt?.measurements.chest === '42', 'dad keeps his chest');
assert(sonShirt?.measurements.chest === '32', 'son keeps his chest');
assert(latestSizingForCustomer(family, 'New Kid', '9876543210', 'shirt') === null, 'new name on same number has empty sizes');

console.log('customer-history.verify ok');

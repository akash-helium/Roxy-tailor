export type StaffType = string;

export interface StaffRoleType {
  slug: string;
  dbId?: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
}

export const DEFAULT_STAFF_TYPES: StaffRoleType[] = [
  { slug: 'cutter', label: 'Cloth Cutter', isSystem: true, sortOrder: 0 },
  { slug: 'tailor', label: 'Tailor (Sewing)', isSystem: true, sortOrder: 1 },
];

export type ClothStatus = 'cutting' | 'ready_to_sew' | 'sewing' | 'completed';

export type GarmentGender = 'male' | 'female';

export interface StaffPayout {
  id: string;
  amount: number;
  date: string;
  note?: string;
  clothIds?: string[];
  productLabel?: string;
  qty?: number;
  rate?: number;
}

export interface ClothStaffJob {
  type: string;
  staffId: string;
  amount: number;
  advance: number;
  final: number;
  remarks: string;
}

export interface DatedAmount {
  amount: number;
  date: string;
}

export interface Staff {
  id: string;
  name: string;
  type: StaffType;
  phone: string;
  notes: string;
  payouts: StaffPayout[];
}

export interface Cloth {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  garment: string;
  garmentType: string;
  gender: GarmentGender;
  fabricColor: string;
  size: string;
  measurements: Record<string, string>;
  inGroup: boolean;
  orderBatchId: string;
  orderCode: string;
  staffJobs: ClothStaffJob[];
  notes: string;
  status: ClothStatus;
  cutterId: string | null;
  tailorId: string | null;
  totalAmount: number;
  discountAmount: number;
  advanceAmount: number;
  advanceDate: string | null;
  partPayments: DatedAmount[];
  finalPaymentAmount: number;
  finalPaymentDate: string | null;
  cutterPayAmount: number;
  cutterPayAdvance: number;
  cutterPayFinal: number;
  cutterPayRemarks: string;
  tailorPayAmount: number;
  tailorPayAdvance: number;
  tailorPayFinal: number;
  tailorPayRemarks: string;
  givenDate: string | null;
  deliveryDate: string | null;
  cutterExpectedDate: string | null;
  tailorExpectedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  staff: Staff[];
  cloths: Cloth[];
}

export const STAFF_TYPE_LABELS: Record<string, string> = {
  cutter: 'Cloth Cutter',
  tailor: 'Tailor (Sewing)',
};

export function staffTypeBadgeClass(slug: string) {
  if (slug === 'cutter') return 'border-cut/25 bg-cut/10 text-cut';
  if (slug === 'tailor') return 'border-sew/25 bg-sew/10 text-sew';
  return 'border-seam bg-paper text-ink-soft';
}

export const CLOTH_STATUS_LABELS: Record<ClothStatus, string> = {
  cutting: 'With Cutter',
  ready_to_sew: 'Ready for Tailor',
  sewing: 'With Tailor',
  completed: 'Completed',
};

export const CLOTH_STATUS_COLORS: Record<ClothStatus, string> = {
  cutting: 'border-cut/25 bg-cut/10 text-cut',
  ready_to_sew: 'border-ready/25 bg-ready/10 text-ready',
  sewing: 'border-sew/25 bg-sew/10 text-sew',
  completed: 'border-done/25 bg-done/10 text-done',
};

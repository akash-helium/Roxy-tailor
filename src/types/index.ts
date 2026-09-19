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
  if (slug === 'cutter') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (slug === 'tailor') return 'bg-violet-100 text-violet-800 border-violet-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export const CLOTH_STATUS_LABELS: Record<ClothStatus, string> = {
  cutting: 'With Cutter',
  ready_to_sew: 'Ready for Tailor',
  sewing: 'With Tailor',
  completed: 'Completed',
};

export const CLOTH_STATUS_COLORS: Record<ClothStatus, string> = {
  cutting: 'bg-amber-100 text-amber-800 border-amber-200',
  ready_to_sew: 'bg-sky-100 text-sky-800 border-sky-200',
  sewing: 'bg-violet-100 text-violet-800 border-violet-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

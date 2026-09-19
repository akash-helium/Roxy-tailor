import { Search } from 'lucide-react';
import type { Cloth, Staff } from '@app/types';
import { clothDescription, formatCalendarDate } from '@app/lib/utils';
import { clothPendingAmount, formatCurrency, getStaffPayFields, staffPayPending } from '@app/lib/payments';
import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
  STAFF_TYPE_LABELS,
  staffTypeBadgeClass,
  type StaffType,
} from '@app/types';
import { Badge } from '@app/components/ui';
import { cn } from '@app/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format';

export function PageIntro({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}

export function AdminPageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
      <PageIntro title={title} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

export function MasterDetail({
  list,
  detail,
  className,
  detailActive = false,
  onDetailBack,
  detailTitle,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
  detailActive?: boolean;
  onDetailBack?: () => void;
  detailTitle?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
        'max-lg:grid-cols-1 lg:h-[min(720px,calc(100dvh-11rem))] lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-200 max-lg:max-h-[min(52dvh,28rem)] lg:border-b-0 lg:border-r',
          detailActive && 'max-lg:hidden',
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
          !detailActive && 'max-lg:hidden',
        )}
      >
        {detailActive && onDetailBack && (
          <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={onDetailBack}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              ← Back to list
            </button>
            {detailTitle && (
              <p className="mt-1 truncate px-2 text-xs font-medium text-slate-500">{detailTitle}</p>
            )}
          </div>
        )}
        {detail}
      </div>
    </div>
  );
}

export function ListPanelHeader({ children }: { children: React.ReactNode }) {
  return <div className="shrink-0 border-b border-slate-100 p-3 sm:p-4">{children}</div>;
}

export function ListPanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-2">{children}</div>;
}

export function SelectableListItem({
  active,
  onClick,
  title,
  subtitle,
  meta,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-3 py-3 text-left transition',
        active
          ? 'bg-indigo-50 ring-1 ring-indigo-200'
          : 'hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold', active ? 'text-indigo-900' : 'text-slate-900')}>
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          {meta && <p className="mt-1 text-xs font-medium text-slate-600">{meta}</p>}
        </div>
        {badge}
      </div>
    </button>
  );
}

export function DetailPanelHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function DetailPanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>;
}

export function EmptyDetail({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <p className="max-w-xs text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function SummaryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3 xl:grid-cols-4">{children}</div>
  );
}

export function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const tones = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', tones[tone])}>{value}</p>
    </div>
  );
}

export function DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StaffTypeBadge({ type, label }: { type: StaffType; label?: string }) {
  return (
    <Badge className={staffTypeBadgeClass(type)}>{label ?? STAFF_TYPE_LABELS[type] ?? type}</Badge>
  );
}

export function ClothStatusBadge({ status }: { status: Cloth['status'] }) {
  const safeStatus = status in CLOTH_STATUS_LABELS ? status : 'cutting';
  return (
    <Badge className={CLOTH_STATUS_COLORS[safeStatus]}>{CLOTH_STATUS_LABELS[safeStatus]}</Badge>
  );
}

function PaymentRow({
  label,
  amount,
  tone = 'default',
}: {
  label: string;
  amount: number;
  tone?: 'default' | 'success' | 'warning';
}) {
  const tones = {
    default: 'text-slate-700',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-semibold', tones[tone])}>{formatCurrency(amount)}</span>
    </div>
  );
}

export function ClothOrderCard({
  cloth,
  staff,
  showCustomer = false,
  staffType,
}: {
  cloth: Cloth;
  staff: Staff[];
  showCustomer?: boolean;
  staffType?: StaffType;
}) {
  const cutter = staff.find((member) => member.id === cloth.cutterId);
  const tailor = staff.find((member) => member.id === cloth.tailorId);
  const pending = clothPendingAmount(cloth);
  const staffPay = staffType ? getStaffPayFields(cloth, staffType) : null;
  const staffPending = staffPay
    ? staffPayPending(staffPay.amount, staffPay.advance, staffPay.final)
    : 0;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-indigo-700">{cloth.code}</span>
            <ClothStatusBadge status={cloth.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-900">{clothDescription(cloth)}</p>
          {showCustomer && (
            <p className="mt-0.5 text-xs text-slate-500">Customer: {cloth.customerName}</p>
          )}
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Updated {formatDateTime(cloth.updatedAt)}</p>
          <p>Created {formatDate(cloth.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Order Details
          </h4>
          <DetailGrid
            items={[
              { label: 'Garment', value: cloth.garment || '—' },
              { label: 'Fabric / Color', value: cloth.fabricColor || '—' },
              { label: 'Measurements', value: cloth.size?.trim() || '—' },
              { label: 'Order date', value: formatCalendarDate(cloth.givenDate) },
              { label: 'Delivery date', value: formatCalendarDate(cloth.deliveryDate) },
              { label: 'Cutter Due', value: formatCalendarDate(cloth.cutterExpectedDate) },
              { label: 'Tailor Due', value: formatCalendarDate(cloth.tailorExpectedDate) },
              { label: 'Cutter', value: cutter?.name ?? '—' },
              { label: 'Tailor', value: tailor?.name ?? '—' },
              { label: 'Notes', value: cloth.notes?.trim() || '—' },
            ]}
          />
        </section>

        <section className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer Payment
            </h4>
            <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <PaymentRow label="Total Bill" amount={cloth.totalAmount} />
              {(cloth.discountAmount ?? 0) > 0 && (
                <PaymentRow label="Discount" amount={cloth.discountAmount} tone="warning" />
              )}
              {(cloth.discountAmount ?? 0) > 0 && (
                <PaymentRow
                  label="Net Bill"
                  amount={cloth.totalAmount - cloth.discountAmount}
                />
              )}
              <PaymentRow label="Advance Paid" amount={cloth.advanceAmount} tone="success" />
              {(cloth.partPayments ?? []).map((item, index) => (
                <PaymentRow
                  key={`part-${index}`}
                  label={`Part ${index + 1}${item.date ? ` · ${item.date}` : ''}`}
                  amount={item.amount}
                  tone="success"
                />
              ))}
              <PaymentRow label="Final Paid" amount={cloth.finalPaymentAmount} tone="success" />
              <PaymentRow label="Pending" amount={pending} tone={pending > 0 ? 'warning' : 'default'} />
            </div>
          </div>

          {staffPay && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff Payment ({STAFF_TYPE_LABELS[staffType!]})
              </h4>
              <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <PaymentRow label="Total Pay" amount={staffPay.amount} />
                <PaymentRow label="Advance Paid" amount={staffPay.advance} tone="success" />
                <PaymentRow label="Final Paid" amount={staffPay.final} tone="success" />
                <PaymentRow
                  label="Pending"
                  amount={staffPending}
                  tone={staffPending > 0 ? 'warning' : 'default'}
                />
                {staffPay.remarks?.trim() && (
                  <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                    Remarks: {staffPay.remarks}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

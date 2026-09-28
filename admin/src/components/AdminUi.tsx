import { Search } from 'lucide-react';
import type { Cloth, Staff } from '@app/types';
import { clothBillName, formatCalendarDate } from '@app/lib/utils';
import {
  clothPaidAmount,
  clothPendingAmount,
  formatCurrency,
  getStaffPayFields,
  staffPayPending,
} from '@app/lib/payments';
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
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
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
        className="w-full rounded-[10px] border border-seam bg-ticket py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brass focus:ring-2 focus:ring-brass/25"
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
        'ticket grid min-h-0 overflow-hidden rounded-[14px]',
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
              className="inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 py-1.5 text-sm font-semibold text-action hover:bg-linen"
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
          ? 'bg-tab/10 ring-1 ring-tab/25'
          : 'hover:bg-paper',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold', active ? 'text-tab' : 'text-ink')}>
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
  const visible = items.filter((item) => {
    if (item.value == null || item.value === false) return false;
    if (typeof item.value === 'string' && (!item.value.trim() || item.value === '—')) return false;
    return true;
  });
  if (visible.length === 0) return null;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {visible.map((item) => (
        <div key={item.label} className="rounded-lg bg-paper px-3 py-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">{item.value}</dd>
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
  const paid = clothPaidAmount(cloth);
  const pending = clothPendingAmount(cloth);
  const staffPay = staffType ? getStaffPayFields(cloth, staffType) : null;
  const staffPending = staffPay
    ? staffPayPending(staffPay.amount, staffPay.advance, staffPay.final)
    : 0;
  const staffPaid = staffPay ? staffPay.advance + staffPay.final : 0;

  return (
    <article className="rounded-xl border border-seam bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold tracking-wide text-ink">
              {cloth.orderCode ? `${cloth.orderCode} · ${cloth.code}` : cloth.code}
            </span>
            <ClothStatusBadge status={cloth.status} />
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-ink">{clothBillName(cloth)}</p>
          {showCustomer && (
            <p className="mt-0.5 text-xs text-ink-muted">{cloth.customerName}</p>
          )}
        </div>
        <p className="shrink-0 text-right text-[11px] text-ink-muted">
          {formatDate(cloth.updatedAt)}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-ink-muted">Bill</p>
          <p className="font-semibold tabular-nums text-ink">{formatCurrency(cloth.totalAmount)}</p>
        </div>
        <div>
          <p className="text-[11px] text-ink-muted">Paid</p>
          <p className="font-semibold tabular-nums text-done">{formatCurrency(paid)}</p>
        </div>
        <div>
          <p className="text-[11px] text-ink-muted">Pending</p>
          <p className={cn('font-semibold tabular-nums', pending > 0 ? 'text-cut' : 'text-ink-muted')}>
            {formatCurrency(pending)}
          </p>
        </div>
      </div>

      {staffPay && (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-seam pt-2 text-sm">
          <div>
            <p className="text-[11px] text-ink-muted">{STAFF_TYPE_LABELS[staffType!]} pay</p>
            <p className="font-semibold tabular-nums">{formatCurrency(staffPay.amount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">Paid</p>
            <p className="font-semibold tabular-nums text-done">{formatCurrency(staffPaid)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">Pending</p>
            <p className={cn('font-semibold tabular-nums', staffPending > 0 ? 'text-cut' : 'text-ink-muted')}>
              {formatCurrency(staffPending)}
            </p>
          </div>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-action">More</summary>
        <div className="mt-2 space-y-3">
          <DetailGrid
            items={[
              { label: 'Fabric / Color', value: cloth.fabricColor },
              { label: 'Measurements', value: cloth.size?.trim() },
              { label: 'Order date', value: formatCalendarDate(cloth.givenDate) },
              { label: 'Delivery date', value: formatCalendarDate(cloth.deliveryDate) },
              { label: 'Cutter due', value: formatCalendarDate(cloth.cutterExpectedDate) },
              { label: 'Tailor due', value: formatCalendarDate(cloth.tailorExpectedDate) },
              { label: 'Cutter', value: cutter?.name },
              { label: 'Tailor', value: tailor?.name },
              { label: 'Notes', value: cloth.notes?.trim() },
              { label: 'Created', value: formatDateTime(cloth.createdAt) },
            ]}
          />
          {(cloth.discountAmount ?? 0) > 0 ||
          cloth.advanceAmount > 0 ||
          (cloth.partPayments ?? []).length > 0 ||
          cloth.finalPaymentAmount > 0 ? (
            <div className="space-y-1.5 rounded-lg bg-paper px-3 py-2">
              {(cloth.discountAmount ?? 0) > 0 && (
                <PaymentRow label="Discount" amount={cloth.discountAmount} tone="warning" />
              )}
              {cloth.advanceAmount > 0 && (
                <PaymentRow label="Advance" amount={cloth.advanceAmount} tone="success" />
              )}
              {(cloth.partPayments ?? []).map((item, index) => (
                <PaymentRow
                  key={`part-${index}`}
                  label={`Part ${index + 1}${item.date ? ` · ${item.date}` : ''}`}
                  amount={item.amount}
                  tone="success"
                />
              ))}
              {cloth.finalPaymentAmount > 0 && (
                <PaymentRow label="Final" amount={cloth.finalPaymentAmount} tone="success" />
              )}
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

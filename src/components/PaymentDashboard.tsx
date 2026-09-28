import { formatCurrency, summarizePayments } from '../lib/payments';
import { clothPendingAmount, clothNetAmount, clothPartPaymentTotal, clothPartPayments } from '../lib/payments';
import { formatCalendarDate } from '../lib/utils';
import type { Cloth } from '../types';

export function PaymentDashboard({ cloths }: { cloths: Cloth[] }) {
  const stats = summarizePayments(cloths);
  const collected = stats.totalAdvance + stats.totalPart + stats.totalFinal;

  const tiles = [
    { label: 'Still to collect', value: stats.totalPending, tone: 'text-cut', fill: 'border-cut/30 bg-cut/10' },
    { label: 'Taken in', value: collected, tone: 'text-done', fill: 'border-done/30 bg-done/10' },
    { label: 'Billed', value: stats.totalBill, tone: 'text-ink', fill: 'border-seam bg-white' },
    { label: 'Advance', value: stats.totalAdvance, tone: 'text-ready', fill: 'border-ready/30 bg-ready/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((item) => (
        <div key={item.label} className={`rounded-[12px] border p-4 shadow-sm ${item.fill}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {item.label}
          </p>
          <p className={`mt-2 font-display text-2xl font-semibold tabular ${item.tone}`}>
            {formatCurrency(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function PaymentSummary({ cloth }: { cloth: Cloth }) {
  const pending = clothPendingAmount(cloth);
  const net = clothNetAmount(cloth);
  const hasDiscount = (cloth.discountAmount ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-[14px] border border-seam bg-white p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Total</p>
        <p className="mt-1 font-display text-xl font-bold tabular text-ink">
          {formatCurrency(cloth.totalAmount)}
        </p>
      </div>
      {hasDiscount && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Discount</p>
          <p className="mt-1 font-display text-xl font-bold tabular text-overdue">
            −{formatCurrency(cloth.discountAmount)}
          </p>
        </div>
      )}
      {hasDiscount && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Net Bill</p>
          <p className="mt-1 font-display text-xl font-bold tabular text-ink">{formatCurrency(net)}</p>
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Advance</p>
        <p className="mt-1 font-display text-xl font-bold tabular text-done">
          {formatCurrency(cloth.advanceAmount)}
        </p>
        {cloth.advanceDate ? (
          <p className="mt-0.5 text-[11px] text-ink-muted">{formatCalendarDate(cloth.advanceDate)}</p>
        ) : null}
      </div>
      {clothPartPaymentTotal(cloth) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Part Paid</p>
          <p className="mt-1 font-display text-xl font-bold tabular text-done">
            {formatCurrency(clothPartPaymentTotal(cloth))}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {clothPartPayments(cloth)
              .map((item) => `${formatCurrency(item.amount)}${item.date ? ` · ${formatCalendarDate(item.date)}` : ''}`)
              .join(', ')}
          </p>
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Pending</p>
        <p className="mt-1 font-display text-xl font-bold tabular text-cut">{formatCurrency(pending)}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Final Paid</p>
        <p className="mt-1 font-display text-xl font-bold tabular text-sew">
          {formatCurrency(cloth.finalPaymentAmount)}
        </p>
        {cloth.finalPaymentDate ? (
          <p className="mt-0.5 text-[11px] text-ink-muted">{formatCalendarDate(cloth.finalPaymentDate)}</p>
        ) : null}
      </div>
    </div>
  );
}

import { Banknote, Clock, IndianRupee, Wallet } from 'lucide-react';
import { clothPendingAmount, clothNetAmount, clothPartPaymentTotal, clothPartPayments, formatCurrency, summarizePayments } from '../lib/payments';
import { formatCalendarDate } from '../lib/utils';
import type { Cloth } from '../types';
import { Card } from './ui';

export function PaymentDashboard({ cloths }: { cloths: Cloth[] }) {
  const stats = summarizePayments(cloths);

  const items = [
    {
      label: 'Total Bill',
      value: stats.totalBill,
      icon: IndianRupee,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Advance',
      value: stats.totalAdvance,
      icon: Wallet,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Part Paid',
      value: stats.totalPart,
      icon: Wallet,
      tone: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Pending',
      value: stats.totalPending,
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Final Paid',
      value: stats.totalFinal,
      icon: Banknote,
      tone: 'bg-sky-50 text-sky-700',
    },
  ];

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payments</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Card key={item.label} className={`py-3 ${item.tone}`}>
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold leading-tight">{formatCurrency(item.value)}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{item.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PaymentSummary({ cloth }: { cloth: Cloth }) {
  const pending = clothPendingAmount(cloth);
  const net = clothNetAmount(cloth);
  const hasDiscount = (cloth.discountAmount ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
      <div>
        <p className="text-[10px] font-medium uppercase text-slate-400">Total</p>
        <p className="font-semibold text-slate-900">{formatCurrency(cloth.totalAmount)}</p>
      </div>
      {hasDiscount && (
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-400">Discount</p>
          <p className="font-semibold text-rose-600">−{formatCurrency(cloth.discountAmount)}</p>
        </div>
      )}
      {hasDiscount && (
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-400">Net Bill</p>
          <p className="font-semibold text-slate-900">{formatCurrency(net)}</p>
        </div>
      )}
      <div>
        <p className="text-[10px] font-medium uppercase text-slate-400">Advance</p>
        <p className="font-semibold text-emerald-700">{formatCurrency(cloth.advanceAmount)}</p>
        {cloth.advanceDate ? (
          <p className="text-[10px] text-slate-400">{formatCalendarDate(cloth.advanceDate)}</p>
        ) : null}
      </div>
      {clothPartPaymentTotal(cloth) > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-400">Part Paid</p>
          <p className="font-semibold text-emerald-700">{formatCurrency(clothPartPaymentTotal(cloth))}</p>
          <p className="text-[10px] text-slate-400">
            {clothPartPayments(cloth)
              .map((item) => `${formatCurrency(item.amount)}${item.date ? ` · ${formatCalendarDate(item.date)}` : ''}`)
              .join(', ')}
          </p>
        </div>
      )}
      <div>
        <p className="text-[10px] font-medium uppercase text-slate-400">Pending</p>
        <p className="font-semibold text-amber-700">{formatCurrency(pending)}</p>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase text-slate-400">Final Paid</p>
        <p className="font-semibold text-sky-700">{formatCurrency(cloth.finalPaymentAmount)}</p>
        {cloth.finalPaymentDate ? (
          <p className="text-[10px] text-slate-400">{formatCalendarDate(cloth.finalPaymentDate)}</p>
        ) : null}
      </div>
    </div>
  );
}

import { MessageCircle, Receipt, ScanBarcode, X } from 'lucide-react';
import type { Cloth } from '../types';
import { groupClothsForStaffTickets, summarizeCustomerOrder } from '../lib/customer-order';
import { formatCurrency } from '../lib/payments';
import { sendOrderConfirmationWhatsApp } from '../lib/whatsapp';
import { Button } from './ui';

export function RegisterPrintPrompt({
  cloths,
  onPrintStaffBarcodes,
  onPrintBill,
  onClose,
}: {
  cloths: Cloth[];
  onPrintStaffBarcodes: () => void;
  onPrintBill: () => void;
  onClose: () => void;
}) {
  const summary = summarizeCustomerOrder(cloths);
  const ticketCount = groupClothsForStaffTickets(cloths).length;
  const customerPhone = cloths[0]?.customerPhone?.trim() ?? '';

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="register-print-title"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Saved</p>
            <h2 id="register-print-title" className="mt-1 text-xl font-bold text-slate-900">
              Order saved successfully
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {summary.customerName} · {summary.pieceCount} piece{summary.pieceCount === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 font-mono text-xs text-indigo-600">
              {summary.codes.join(' · ') || '—'}
            </p>
            {customerPhone ? (
              <p className="mt-1 text-xs text-slate-500">WhatsApp: {customerPhone}</p>
            ) : null}
            {summary.totalPending > 0 && (
              <p className="mt-2 text-sm font-semibold text-amber-700">
                Balance due: {formatCurrency(summary.totalPending)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">What would you like to print?</p>

        <div className="space-y-3">
          {customerPhone ? (
            <Button
              variant="secondary"
              onClick={() => sendOrderConfirmationWhatsApp(cloths, customerPhone)}
              className="w-full rounded-full py-4"
            >
              <MessageCircle className="h-5 w-5" />
              Send WhatsApp confirmation
            </Button>
          ) : null}
          <Button
            onClick={onPrintStaffBarcodes}
            className="w-full rounded-full py-4"
          >
            <ScanBarcode className="h-5 w-5" />
            Print Staff Tickets{ticketCount > 1 ? ` (${ticketCount})` : ''}
          </Button>
          <Button
            variant="secondary"
            onClick={onPrintBill}
            className="w-full rounded-full py-4"
          >
            <Receipt className="h-5 w-5" />
            Print Customer Bill
          </Button>
          <p className="text-center text-xs text-slate-400">
            Same cloth quantity prints as one staff ticket. Customer bill groups the order.
          </p>
          <Button variant="ghost" onClick={onClose} className="w-full rounded-full py-3 text-slate-500">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Trash2, Wallet, X } from 'lucide-react';
import type { Cloth, Staff, StaffPayout } from '../types';
import { updateStaffPayouts, writeStaffJobs } from '../lib/data';
import {
  formatCurrency,
  getStaffCloths,
  parseAmount,
  staffPayPending,
  summarizeStaffPayments,
  type StaffPayInput,
} from '../lib/payments';
import { formatCalendarDate, generateId, todayDateString } from '../lib/utils';
import { jobForStaff, jobsFromLegacyColumns, upsertStaffJob } from '../lib/staff-jobs';
import { payoutProductLine, unpaidStaffGroups } from '../lib/staff-ledger';
import { sortStaffPayouts } from '../lib/staff-payouts';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { Button, Input, Select, Textarea, showToast } from './ui';

function StaffPayForm({
  pay,
  onChange,
}: {
  pay: StaffPayInput;
  onChange: (pay: StaffPayInput) => void;
}) {
  const pending = staffPayPending(pay.amount, pay.advance, pay.final);

  return (
    <div className="space-y-3">
      <Input
        label="Pay Amount (₹)"
        type="number"
        min="0"
        step="0.01"
        value={pay.amount || ''}
        onChange={(e) => onChange({ ...pay, amount: parseAmount(e.target.value) })}
        placeholder="Agreed pay for this cloth"
      />
      <Input
        label="Advance Paid (₹)"
        type="number"
        min="0"
        step="0.01"
        value={pay.advance || ''}
        onChange={(e) => onChange({ ...pay, advance: parseAmount(e.target.value) })}
        placeholder="Advance to staff"
      />
      <Input
        label="Final Paid (₹)"
        type="number"
        min="0"
        step="0.01"
        value={pay.final || ''}
        onChange={(e) => onChange({ ...pay, final: parseAmount(e.target.value) })}
        placeholder="Final payment to staff"
      />
      <div className="rounded-xl bg-white px-3 py-2 text-sm">
        <span className="text-slate-500">Pending: </span>
        <strong className="text-amber-700">{formatCurrency(pending)}</strong>
      </div>
      <Textarea
        label="Remarks"
        value={pay.remarks}
        onChange={(e) => onChange({ ...pay, remarks: e.target.value })}
        placeholder="Payment notes for this cloth"
        rows={2}
      />
    </div>
  );
}

export function StaffLedgerPanel({
  staff,
  cloths,
  onUpdated,
  layout = 'stack',
}: {
  staff: Staff;
  cloths: Cloth[];
  onUpdated: () => void;
  layout?: 'stack' | 'split';
}) {
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  const liveStaff: Staff = { ...staff, payouts: staff.payouts ?? [] };
  const summary = summarizeStaffPayments(liveStaff, cloths);
  const unpaidGroups = unpaidStaffGroups(liveStaff, cloths);
  const ledger = sortStaffPayouts(liveStaff.payouts);
  const [productKey, setProductKey] = useState('');
  const [qty, setQty] = useState('1');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = unpaidGroups.find((group) => group.key === productKey) ?? unpaidGroups[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setProductKey('');
      setQty('1');
      setAmount('');
      return;
    }
    setProductKey(selected.key);
    setQty('1');
    setAmount(String(Math.round(selected.rate * 100) / 100));
  }, [selected?.key, selected?.rate]);

  const payQty = useMemo(() => {
    const parsed = Math.floor(Number(qty));
    if (!selected) return 1;
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, selected.unpaidQty);
  }, [qty, selected]);

  const suggested = selected ? Math.round(selected.rate * payQty * 100) / 100 : 0;

  async function handlePay() {
    if (!selected) {
      setError('No unpaid product for this staff');
      return;
    }
    const payoutAmount = parseAmount(amount) || suggested;
    if (payoutAmount <= 0) {
      setError('Enter the amount you are paying');
      return;
    }
    const pieces = selected.unpaid.slice(0, payQty);
    if (pieces.length === 0) {
      setError('Select how many pieces to pay');
      return;
    }
    const perPiece = Math.round((payoutAmount / pieces.length) * 100) / 100;
    setBusy(true);
    setError(null);
    try {
      for (const piece of pieces) {
        const job = jobForStaff(piece, staff.id, staff.type);
        const pieceAmount = job?.amount || selected.rate || perPiece;
        const nextFinal = Math.min(pieceAmount, (job?.final ?? 0) + perPiece);
        const jobs = upsertStaffJob(jobsFromLegacyColumns(piece), {
          type: staff.type,
          staffId: staff.id,
          amount: pieceAmount,
          advance: job?.advance ?? 0,
          final: nextFinal,
          remarks: job?.remarks ?? '',
        });
        await writeStaffJobs(piece.id, jobs);
      }
      await updateStaffPayouts(staff.id, [
        {
          id: generateId(),
          amount: payoutAmount,
          date: date.trim() || todayDateString(),
          note: note.trim() || undefined,
          clothIds: pieces.map((item) => item.id),
          productLabel: `${selected.label} · ${selected.customerName}`,
          qty: pieces.length,
          rate: selected.rate,
        },
        ...liveStaff.payouts,
      ]);
      showToast(`Paid ${formatCurrency(payoutAmount)} for ${pieces.length} ${selected.label}`);
      setNote('');
      setDate(todayDateString());
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payout');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePayout(payout: StaffPayout) {
    const ids = new Set(payout.clothIds ?? []);
    const share =
      payout.qty && payout.qty > 0
        ? payout.amount / payout.qty
        : payout.clothIds?.length
          ? payout.amount / payout.clothIds.length
          : payout.amount;
    setBusy(true);
    setError(null);
    try {
      if (ids.size > 0) {
        for (const cloth of assigned) {
          if (!ids.has(cloth.id)) continue;
          const job = jobForStaff(cloth, staff.id, staff.type);
          const jobs = upsertStaffJob(jobsFromLegacyColumns(cloth), {
            type: staff.type,
            staffId: staff.id,
            amount: job?.amount ?? 0,
            advance: job?.advance ?? 0,
            final: Math.max(0, (job?.final ?? 0) - share),
            remarks: job?.remarks ?? '',
          });
          await writeStaffJobs(cloth.id, jobs);
        }
      }
      await updateStaffPayouts(
        staff.id,
        liveStaff.payouts.filter((item) => item.id !== payout.id),
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove payout');
    } finally {
      setBusy(false);
    }
  }

  const payForm = (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">New payout</p>
        <p className="text-xs text-slate-500">Choose the cloth, how many pieces, then the amount.</p>
      </div>
      {unpaidGroups.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
          Nothing pending. All assigned work is paid, or this staff has no cloths yet.
        </p>
      ) : (
        <>
          <Select
            label="Product"
            value={selected?.key ?? ''}
            onChange={(e) => setProductKey(e.target.value)}
          >
            {unpaidGroups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label} · {group.customerName} · {group.unpaidQty} unpaid of {group.totalQty}
              </option>
            ))}
          </Select>
          {selected && (
            <p className="text-xs text-slate-500">
              Rate {formatCurrency(selected.rate)} each · {formatCurrency(selected.pending)} still unpaid
              {selected.codes.length > 0 ? ` · ${selected.codes.join(', ')}` : ''}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Pieces to pay (max ${selected?.unpaidQty ?? 0})`}
              type="number"
              min="1"
              max={selected?.unpaidQty ?? 1}
              step="1"
              value={qty}
              onChange={(e) => {
                const next = e.target.value;
                setQty(next);
                const count = Math.min(
                  Math.max(1, Math.floor(Number(next)) || 1),
                  selected?.unpaidQty ?? 1,
                );
                if (selected) setAmount(String(Math.round(selected.rate * count * 100) / 100));
              }}
            />
            <Input
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(suggested || '')}
            />
          </div>
          <Input
            label="Payout date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cash / UPI"
          />
        </>
      )}
      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}
      <Button
        className="w-full rounded-full py-3"
        disabled={busy || unpaidGroups.length === 0}
        onClick={() => void handlePay()}
      >
        <Wallet className="h-4 w-4" />
        {busy
          ? 'Saving...'
          : selected
            ? `Pay ${formatCurrency(parseAmount(amount) || suggested)} for ${payQty} ${selected.label}`
            : 'Pay'}
      </Button>
    </div>
  );

  const history = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-400" />
        <p className="text-sm font-semibold text-slate-800">Previous payouts</p>
      </div>
      {ledger.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No payouts recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {ledger.map((payout) => (
            <div
              key={payout.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{formatCurrency(payout.amount)}</p>
                <p className="text-sm text-slate-700">{payoutProductLine(payout)}</p>
                <p className="text-xs text-slate-500">
                  {formatCalendarDate(payout.date || null)}
                  {payout.rate ? ` · ${formatCurrency(payout.rate)} each` : ''}
                  {payout.note ? ` · ${payout.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemovePayout(payout)}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                aria-label="Remove payout"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">To pay</p>
          <p className="font-semibold text-slate-900">{formatCurrency(summary.totalAmount)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-700">Paid</p>
          <p className="font-semibold text-emerald-800">{formatCurrency(summary.paid)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">Pending</p>
          <p className="font-semibold text-amber-800">{formatCurrency(summary.totalPending)}</p>
        </div>
      </div>
      <div className={layout === 'split' ? 'grid gap-6 lg:grid-cols-2' : 'space-y-4'}>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">{payForm}</div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">{history}</div>
      </div>
    </div>
  );
}

export function StaffPaymentSheet({
  staff,
  cloths,
  onClose,
  onUpdated,
}: {
  staff: Staff;
  cloths: Cloth[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  useAndroidBackHandler(onClose);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{staff.name}</p>
            <p className="text-sm text-slate-500">Pay by product and quantity</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <StaffLedgerPanel staff={staff} cloths={cloths} onUpdated={onUpdated} />
      </div>
    </div>,
    document.body,
  );
}

export { StaffPayForm };

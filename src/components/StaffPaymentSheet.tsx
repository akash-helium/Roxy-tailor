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
import {
  allocatePayout,
  payoutProductLine,
  selectedLineDue,
  staffPayRoleLine,
  staffWorkGroups,
  workLineQtyCopy,
} from '../lib/staff-ledger';
import { sortStaffPayouts } from '../lib/staff-payouts';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { Button, Input, Textarea, showToast } from './ui';

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
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>
      <div className="rounded-[10px] bg-ticket px-3 py-2 text-sm">
        <span className="text-ink-muted">Pending: </span>
        <strong className="tabular text-cut">{formatCurrency(pending)}</strong>
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
  const { getLabel } = useStaffTypes();
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  const liveStaff: Staff = { ...staff, payouts: staff.payouts ?? [] };
  const summary = summarizeStaffPayments(liveStaff, cloths);
  const workGroups = staffWorkGroups(liveStaff, cloths);
  const payableGroups = workGroups.filter((group) => !group.needsRate && group.pending > 0);
  const ledger = sortStaffPayouts(liveStaff.payouts);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [payNowByKey, setPayNowByKey] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payableKeySig = payableGroups.map((group) => group.key).join('|');

  useEffect(() => {
    setSelectedKeys(payableGroups.map((group) => group.key));
    setPayNowByKey(Object.fromEntries(payableGroups.map((group) => [group.key, group.unpaidQty])));
    // payableGroups is derived from cloths/staff; signature is the stable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.id, payableKeySig]);

  const selectedGroups = useMemo(
    () => payableGroups.filter((group) => selectedKeys.includes(group.key)),
    [payableGroups, selectedKeys],
  );

  const selectedDue = useMemo(
    () =>
      Math.round(
        selectedGroups.reduce(
          (sum, group) =>
            sum + selectedLineDue(group, payNowByKey[group.key] ?? group.unpaidQty, staff),
          0,
        ) * 100,
      ) / 100,
    [selectedGroups, payNowByKey, staff],
  );

  useEffect(() => {
    setAmount(selectedDue > 0 ? String(selectedDue) : '');
  }, [selectedDue]);

  const payoutAmount = parseAmount(amount) || selectedDue;
  const canPay = selectedGroups.length > 0 && payoutAmount > 0 && !busy;

  async function handlePay() {
    if (selectedGroups.length === 0) {
      setError('Tick the work you are paying for');
      return;
    }
    if (payoutAmount <= 0) {
      setError('Enter the amount you are paying');
      return;
    }
    const allocations = allocatePayout(
      liveStaff,
      selectedGroups.map((group) => ({
        group,
        payNowQty: payNowByKey[group.key] ?? group.unpaidQty,
      })),
      payoutAmount,
    );
    if (allocations.length === 0) {
      setError('Tick the work you are paying for');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const line of allocations) {
        for (const { cloth, pay } of line.piecePays) {
          const job = jobForStaff(cloth, staff.id, staff.type);
          const pieceAmount = job?.amount || line.rate || pay;
          const nextFinal = Math.min(pieceAmount, (job?.final ?? 0) + pay);
          const jobs = upsertStaffJob(jobsFromLegacyColumns(cloth), {
            type: staff.type,
            staffId: staff.id,
            amount: pieceAmount,
            advance: job?.advance ?? 0,
            final: nextFinal,
            remarks: job?.remarks ?? '',
          });
          await writeStaffJobs(cloth.id, jobs);
        }
      }
      const paidTotal = allocations.reduce((sum, line) => sum + line.amount, 0);
      const newRows: StaffPayout[] = allocations.map((line) => ({
        id: generateId(),
        amount: line.amount,
        date: date.trim() || todayDateString(),
        note: note.trim() || undefined,
        clothIds: line.clothIds,
        productLabel: `${line.group.label} · ${line.group.customerName}`,
        qty: line.qty,
        rate: line.rate,
      }));
      await updateStaffPayouts(staff.id, [...newRows, ...liveStaff.payouts]);
      const toast =
        allocations.length === 1
          ? `Paid ${formatCurrency(paidTotal)} for ${allocations[0]!.qty} ${allocations[0]!.group.label}`
          : `Paid ${formatCurrency(paidTotal)} for ${allocations.length} jobs`;
      showToast(toast);
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
    const ok = window.confirm('This puts that work back in still due.');
    if (!ok) return;
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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Pay now</p>
        <p className="text-xs text-slate-500">Tick the work you are paying for. Still due is work not paid yet.</p>
      </div>
      {workGroups.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
          Nothing still due. All assigned work is paid, or this person has no cloths yet.
        </p>
      ) : (
        <div className="space-y-2">
          {workGroups.map((group) => {
            const checked = selectedKeys.includes(group.key);
            const payNow = payNowByKey[group.key] ?? group.unpaidQty;
            const lineDue = group.needsRate
              ? 0
              : selectedLineDue(group, checked ? payNow : group.unpaidQty, liveStaff);
            return (
              <div
                key={group.key}
                className={`rounded-xl border px-3 py-3 ${
                  group.needsRate
                    ? 'border-amber-200 bg-amber-50/70'
                    : checked
                      ? 'border-action/30 bg-white'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-action focus:ring-action/30"
                    checked={checked}
                    disabled={group.needsRate}
                    onChange={() => {
                      setSelectedKeys((current) =>
                        current.includes(group.key)
                          ? current.filter((key) => key !== group.key)
                          : [...current, group.key],
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-semibold text-slate-900">{group.label}</span>
                        <span className="block text-sm text-slate-600">{group.customerName}</span>
                      </span>
                      {!group.needsRate ? (
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {formatCurrency(checked ? lineDue : group.pending)}
                        </span>
                      ) : null}
                    </span>
                    {group.needsRate ? (
                      <span className="mt-1 block text-xs text-amber-800">
                        No rate set — add cutter/tailor rate for this cloth type
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-slate-500">
                        {workLineQtyCopy(group)}
                        {' · '}
                        {formatCurrency(group.rate)} each
                      </span>
                    )}
                  </span>
                </label>
                {!group.needsRate && checked && group.unpaidQty > 1 ? (
                  <div className="mt-3 ps-7">
                    <Input
                      label={`How many ${group.label} to pay now`}
                      type="number"
                      min="1"
                      max={group.unpaidQty}
                      step="1"
                      value={String(payNow)}
                      onChange={(e) => {
                        const count = Math.min(
                          Math.max(1, Math.floor(Number(e.target.value)) || 1),
                          group.unpaidQty,
                        );
                        setPayNowByKey((current) => ({ ...current, [group.key]: count }));
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {payableGroups.length > 0 ? (
        <>
          <p className="text-sm text-slate-600">
            Selected {formatCurrency(selectedDue)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(selectedDue || '')}
            />
            <Input
              label="Pay date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Input
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cash / UPI"
          />
        </>
      ) : null}
      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      )}
      <Button className="w-full rounded-full py-3" disabled={!canPay} onClick={() => void handlePay()}>
        <Wallet className="h-4 w-4" />
        {busy
          ? 'Saving...'
          : selectedGroups.length === 0
            ? 'Tick the work you are paying for'
            : `Pay ${formatCurrency(payoutAmount)} to ${staff.name}`}
      </Button>
    </div>
  );

  const history = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-400" />
        <p className="text-sm font-semibold text-slate-800">Already paid</p>
      </div>
      {ledger.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No payments yet.</p>
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
                aria-label="Undo payment"
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
      <p className="text-sm text-slate-600">{staffPayRoleLine(staff.type, getLabel(staff.type))}</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">To pay</p>
          <p className="font-semibold text-slate-900">{formatCurrency(summary.totalAmount)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-700">Already paid</p>
          <p className="font-semibold text-emerald-800">{formatCurrency(summary.paid)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">Still due</p>
          <p className="font-semibold text-amber-800">{formatCurrency(summary.totalPending)}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">Still due is work not paid yet.</p>
      <div className={layout === 'split' ? 'grid gap-6 lg:grid-cols-2' : 'space-y-4'}>
        <div className="rounded-[14px] border border-action/20 bg-action/5 p-4">{payForm}</div>
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
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-[18px] border border-seam bg-ticket p-5 shadow-xl sm:max-h-[min(90dvh,860px)] sm:w-[min(64rem,calc(100vw-3rem))] sm:rounded-[18px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{staff.name}</p>
            <p className="text-sm text-slate-500">Pay for this work</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <StaffLedgerPanel staff={staff} cloths={cloths} onUpdated={onUpdated} layout="split" />
      </div>
    </div>,
    document.body,
  );
}

export { StaffPayForm };

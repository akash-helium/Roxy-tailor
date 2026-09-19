import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Plus, Save, Trash2, X } from 'lucide-react';
import type { Cloth, Staff, StaffPayout } from '../types';
import { updateClothStaffPayments, updateStaffPayouts, writeStaffJobs } from '../lib/data';
import {
  formatCurrency,
  getStaffCloths,
  getStaffPayFields,
  parseAmount,
  staffPayPatch,
  staffPayPending,
  summarizeStaffPayments,
  type StaffPayInput,
} from '../lib/payments';
import { clothDescription, clothBillName, formatCalendarDate, generateId, todayDateString } from '../lib/utils';
import { groupClothsForStaffTickets } from '../lib/customer-order';
import { jobForStaff, jobsFromLegacyColumns, upsertStaffJob } from '../lib/staff-jobs';
import { sortStaffPayouts } from '../lib/staff-payouts';
import { CLOTH_STATUS_COLORS, CLOTH_STATUS_LABELS } from '../types';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { Badge, Button, Card, Input, Textarea } from './ui';

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

function ClothStaffPayRow({
  cloth,
  staff,
  onSaved,
}: {
  cloth: Cloth;
  staff: Staff;
  onSaved: () => void;
}) {
  const initial = getStaffPayFields(cloth, staff.type, staff.id);
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<StaffPayInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = staffPayPending(pay.amount, pay.advance, pay.final);
  const status = cloth.status in CLOTH_STATUS_LABELS ? cloth.status : 'cutting';

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const patch = staffPayPatch(staff.type, pay);
      if (Object.keys(patch).length > 0) {
        await updateClothStaffPayments(cloth.id, patch);
      }
      const jobs = upsertStaffJob(jobsFromLegacyColumns(cloth), {
        type: staff.type,
        staffId: staff.id,
        amount: pay.amount,
        advance: pay.advance,
        final: pay.final,
        remarks: pay.remarks,
      });
      await writeStaffJobs(cloth.id, jobs);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold text-indigo-600">{cloth.code}</p>
            <Badge className={CLOTH_STATUS_COLORS[status]}>{CLOTH_STATUS_LABELS[status]}</Badge>
          </div>
          <p className="truncate font-medium text-slate-900">{cloth.customerName}</p>
          <p className="text-xs text-slate-500">{clothDescription(cloth)} · Pending {formatCurrency(pending)}</p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          {error && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
          <StaffPayForm pay={pay} onChange={setPay} />
          <Button
            className="mt-4 w-full rounded-full py-3"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            <Save className="h-4 w-4" />
            {busy ? 'Saving...' : 'Save Payment'}
          </Button>
        </div>
      )}
    </Card>
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
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  const liveStaff: Staff = { ...staff, payouts: staff.payouts ?? [] };
  const summary = summarizeStaffPayments(liveStaff, cloths);
  const unpaidGroups = groupClothsForStaffTickets(assigned).map((group) => {
    const primary = group[0]!;
    const job = jobForStaff(primary, staff.id, staff.type);
    const rate = job?.amount ?? getStaffPayFields(primary, staff.type).amount;
    const pending = group.reduce((sum, piece) => {
      const pieceJob = jobForStaff(piece, staff.id, staff.type);
      const amount = pieceJob?.amount ?? rate;
      return sum + staffPayPending(amount, pieceJob?.advance ?? 0, pieceJob?.final ?? 0);
    }, 0);
    return {
      key: group.map((item) => item.id).sort().join(','),
      cloths: group,
      label: clothBillName(primary),
      qty: group.length,
      rate,
      pending,
      codes: [...new Set(group.map((item) => item.code))],
    };
  }).filter((group) => group.pending > 0);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ledger = sortStaffPayouts(liveStaff.payouts);
  const selectedGroups = unpaidGroups.filter((group) => selectedKeys.includes(group.key));
  const selectedTotal = selectedGroups.reduce((sum, group) => sum + group.pending, 0);
  const selectedClothIds = selectedGroups.flatMap((group) => group.cloths.map((item) => item.id));
  const selectedNote =
    selectedGroups.map((group) => `${group.label} ×${group.qty}`).join(', ') || undefined;

  async function savePayouts(next: StaffPayout[]) {
    setBusy(true);
    setError(null);
    try {
      await updateStaffPayouts(staff.id, next);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payout');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPayout() {
    const selected = selectedGroups.length > 0;
    const payoutAmount = selected ? selectedTotal : parseAmount(amount);
    if (payoutAmount <= 0) {
      setError(selected ? 'Select unpaid cloths to pay' : 'Enter a payout amount');
      return;
    }
    if (selected) {
      for (const group of selectedGroups) {
        for (const piece of group.cloths) {
          const job = jobForStaff(piece, staff.id, staff.type);
          const jobs = upsertStaffJob(jobsFromLegacyColumns(piece), {
            type: staff.type,
            staffId: staff.id,
            amount: job?.amount ?? group.rate,
            advance: job?.advance ?? 0,
            final: job?.amount ?? group.rate,
            remarks: job?.remarks ?? '',
          });
          await writeStaffJobs(piece.id, jobs);
        }
      }
    }
    await savePayouts([
      {
        id: generateId(),
        amount: payoutAmount,
        date: date.trim() || todayDateString(),
        note: note.trim() || selectedNote,
        clothIds: selected ? selectedClothIds : undefined,
      },
      ...liveStaff.payouts,
    ]);
    setAmount('');
    setNote('');
    setSelectedKeys([]);
    setDate(todayDateString());
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{staff.name}</p>
            <p className="text-sm text-slate-500">
              {assigned.length} cloth{assigned.length === 1 ? '' : 's'} · Pay by cloth and quantity
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Total pay</p>
            <p className="font-semibold text-slate-900">{formatCurrency(summary.totalAmount)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-xs text-emerald-700">Paid</p>
            <p className="font-semibold text-emerald-800">{formatCurrency(summary.paid)}</p>
          </div>
          <div className="col-span-2 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">Pending to pay</p>
            <p className="font-semibold text-amber-800">{formatCurrency(summary.totalPending)}</p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Unpaid work</p>
          {unpaidGroups.length === 0 ? (
            <p className="text-xs text-slate-500">No unpaid cloths for this staff.</p>
          ) : (
            <div className="mb-3 space-y-2">
              {unpaidGroups.map((group) => (
                <label
                  key={group.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedKeys.includes(group.key)}
                    onChange={(event) => {
                      setSelectedKeys((current) =>
                        event.target.checked
                          ? [...current, group.key]
                          : current.filter((key) => key !== group.key),
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      {group.label} ×{group.qty}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatCurrency(group.rate)} each · {formatCurrency(group.pending)} ·{' '}
                      {group.codes.join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {error && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
          {selectedGroups.length === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Payout amount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
              />
              <Input
                label="Payout date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          )}
          {selectedGroups.length > 0 && (
            <Input
              label="Payout date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          )}
          <div className="mt-3">
            <Input
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={selectedNote ?? 'Cash / UPI'}
            />
          </div>
          <Button
            className="mt-3 w-full rounded-full py-3"
            disabled={busy}
            onClick={() => void handleAddPayout()}
          >
            <Plus className="h-4 w-4" />
            {busy
              ? 'Saving...'
              : selectedGroups.length > 0
                ? `Pay selected (${formatCurrency(selectedTotal)})`
                : 'Add payout'}
          </Button>

          {ledger.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No payouts recorded yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {ledger.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{formatCurrency(payout.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {formatCalendarDate(payout.date || null)}
                      {payout.note ? ` · ${payout.note}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void savePayouts(liveStaff.payouts.filter((item) => item.id !== payout.id))
                    }
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

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Agreed pay per cloth
        </p>
        {assigned.length === 0 ? (
          <Card className="py-8 text-center text-sm text-slate-500">
            No cloths assigned to this staff yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {assigned.map((cloth) => (
              <ClothStaffPayRow
                key={cloth.id}
                cloth={cloth}
                staff={staff}
                onSaved={onUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export { StaffPayForm };

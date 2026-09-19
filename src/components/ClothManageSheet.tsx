import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, X } from 'lucide-react';
import type { Cloth, Staff } from '../types';
import { getStaffById, updateClothPayments, updateClothDates, updateClothMeasurements, updateClothCustomerPhone, adjustClothQuantity, writeStaffJobs } from '../lib/data';
import { normalizeCustomerPhone } from '../lib/whatsapp';
import { clothPendingAmount, clothNetAmount, formatCurrency, parseAmount, parsePartPaymentDrafts, emptyPartPaymentDraft } from '../lib/payments';
import { formatCalendarDate, isPastDue, clothDescription, todayDateString } from '../lib/utils';
import { garmentDisplayLabel, getGarmentType } from '../lib/garments';
import { formatMeasurementsSummary } from '../lib/measurements';
import { groupClothsForStaffTickets } from '../lib/customer-order';
import { jobsFromLegacyColumns, staffRateForGarment, upsertStaffJob } from '../lib/staff-jobs';
import { StaffPayForm } from './StaffPaymentSheet';
import { GarmentSizingForm } from './GarmentSizingForm';
import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
} from '../types';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { PaymentSummary } from './PaymentDashboard';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import { Badge, Button, Input, Select, showToast } from './ui';

export function ClothManageSheet({
  cloth,
  orderCloths,
  staff,
  onClose,
  onUpdated,
  onShowBarcode,
}: {
  cloth: Cloth;
  orderCloths?: Cloth[];
  staff: Staff[];
  onClose: () => void;
  onUpdated: () => void;
  onShowBarcode: () => void;
}) {
  const [totalAmount, setTotalAmount] = useState(String(cloth.totalAmount || ''));
  const [discountAmount, setDiscountAmount] = useState(String(cloth.discountAmount || ''));
  const [advanceAmount, setAdvanceAmount] = useState(String(cloth.advanceAmount || ''));
  const [advanceDate, setAdvanceDate] = useState(
    cloth.advanceDate || (cloth.advanceAmount ? cloth.givenDate ?? todayDateString() : ''),
  );
  const [partPaymentDrafts, setPartPaymentDrafts] = useState(
    (cloth.partPayments ?? []).length > 0
      ? cloth.partPayments.map((item) => ({ amount: String(item.amount), date: item.date || '' }))
      : [emptyPartPaymentDraft(todayDateString())],
  );
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(String(cloth.finalPaymentAmount || ''));
  const [finalPaymentDate, setFinalPaymentDate] = useState(cloth.finalPaymentDate || '');
  const [cutterPay, setCutterPay] = useState({
    amount: cloth.cutterPayAmount,
    advance: cloth.cutterPayAdvance,
    final: cloth.cutterPayFinal,
    remarks: cloth.cutterPayRemarks,
  });
  const [tailorPay, setTailorPay] = useState({
    amount: cloth.tailorPayAmount,
    advance: cloth.tailorPayAdvance,
    final: cloth.tailorPayFinal,
    remarks: cloth.tailorPayRemarks,
  });
  const [sizing, setSizing] = useState({
    garmentType: cloth.garmentType ?? '',
    gender: cloth.gender ?? 'male',
    measurements: cloth.measurements ?? {},
    inGroup: cloth.inGroup ?? false,
  });
  const [givenDate, setGivenDate] = useState(cloth.givenDate ?? '');
  const [deliveryDate, setDeliveryDate] = useState(cloth.deliveryDate ?? '');
  const [cutterExpectedDate, setCutterExpectedDate] = useState(cloth.cutterExpectedDate ?? '');
  const [tailorExpectedDate, setTailorExpectedDate] = useState(cloth.tailorExpectedDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [customerPhone, setCustomerPhone] = useState(cloth.customerPhone ?? '');
  const { types: staffRoleTypes, getLabel: staffTypeLabel } = useStaffTypes();
  const extraStaffTypes = staffRoleTypes.filter((item) => item.slug !== 'cutter' && item.slug !== 'tailor');
  const extraJobs = jobsFromLegacyColumns(cloth).filter(
    (job) => job.type !== 'cutter' && job.type !== 'tailor',
  );
  const [extraAssign, setExtraAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries(extraJobs.map((job) => [job.type, job.staffId])),
  );
  const [extraPay, setExtraPay] = useState<Record<string, { amount: number; advance: number; final: number; remarks: string }>>(
    () =>
      Object.fromEntries(
        extraJobs.map((job) => [
          job.type,
          { amount: job.amount, advance: job.advance, final: job.final, remarks: job.remarks },
        ]),
      ),
  );

  const cutter = getStaffById(staff, cloth.cutterId);
  const tailor = getStaffById(staff, cloth.tailorId);
  const status = cloth.status in CLOTH_STATUS_LABELS ? cloth.status : 'cutting';
  const cutterOverdue =
    status === 'cutting' && isPastDue(cutterExpectedDate || null, false);
  const tailorOverdue =
    status === 'sewing' && isPastDue(tailorExpectedDate || null, false);
  const groupQty = useMemo(() => {
    const list = orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
    const group = groupClothsForStaffTickets(list).find((items) =>
      items.some((item) => item.id === cloth.id),
    );
    return group?.length ?? 1;
  }, [orderCloths, cloth]);

  useEffect(() => {
    setQuantity(String(groupQty));
    setCustomerPhone(cloth.customerPhone ?? '');
  }, [cloth.id, cloth.customerPhone, groupQty]);

  useAndroidBackHandler(onClose);

  const preview: Cloth = {
    ...cloth,
    totalAmount: parseAmount(totalAmount),
    discountAmount: parseAmount(discountAmount),
    advanceAmount: parseAmount(advanceAmount),
    advanceDate: parseAmount(advanceAmount) > 0 ? advanceDate || todayDateString() : null,
    partPayments: parsePartPaymentDrafts(partPaymentDrafts).map((item) => ({
      ...item,
      date: item.date || todayDateString(),
    })),
    finalPaymentAmount: parseAmount(finalPaymentAmount),
    finalPaymentDate:
      parseAmount(finalPaymentAmount) > 0 ? finalPaymentDate || todayDateString() : null,
  };

  const previewCloth = {
    ...cloth,
    garmentType: sizing.garmentType,
    gender: sizing.gender,
    measurements: sizing.measurements,
    size: formatMeasurementsSummary(sizing.garmentType, sizing.measurements) || cloth.size,
  };

  async function handleSave() {
    setError(null);
    const garmentType = getGarmentType(sizing.garmentType);
    if (!garmentType) {
      setError('Please select a cloth type');
      return;
    }
    const total = parseAmount(totalAmount);
    const discount = parseAmount(discountAmount);
    if (discount > total) {
      setError('Discount cannot exceed total amount');
      return;
    }
    const phoneResult = normalizeCustomerPhone(customerPhone);
    if (!phoneResult.ok) {
      setError(phoneResult.error);
      return;
    }

    setBusy(true);
    try {
      const sizeSummary = formatMeasurementsSummary(sizing.garmentType, sizing.measurements);
      const garmentLabel = garmentDisplayLabel(sizing.garmentType, garmentType.label);
      await updateClothMeasurements(cloth.id, {
        garment: garmentLabel,
        garmentType: sizing.garmentType,
        gender: sizing.gender,
        size: sizeSummary,
        measurements: sizing.measurements,
        inGroup: sizing.inGroup,
      });
      const list = orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
      await updateClothCustomerPhone(
        [...new Set(list.map((item) => item.id))],
        phoneResult.phone,
      );
      const group =
        groupClothsForStaffTickets(list).find((items) =>
          items.some((item) => item.id === cloth.id),
        ) ?? [cloth];
      const nextQty = Math.min(50, Math.max(1, Math.floor(Number(quantity)) || 1));
      await adjustClothQuantity(
        {
          ...cloth,
          customerPhone: phoneResult.phone,
          garment: garmentLabel,
          garmentType: sizing.garmentType,
          gender: sizing.gender,
          size: sizeSummary,
          measurements: sizing.measurements,
          inGroup: sizing.inGroup,
        },
        group,
        nextQty,
      );
      await updateClothDates(cloth.id, {
        givenDate: givenDate.trim() || null,
        deliveryDate: deliveryDate.trim() || null,
        cutterExpectedDate: cutterExpectedDate.trim() || null,
        tailorExpectedDate: tailorExpectedDate.trim() || null,
      });
      await updateClothPayments(cloth.id, {
        totalAmount: total,
        discountAmount: discount,
        advanceAmount: parseAmount(advanceAmount),
        advanceDate: parseAmount(advanceAmount) > 0 ? advanceDate.trim() || todayDateString() : null,
        partPayments: parsePartPaymentDrafts(partPaymentDrafts).map((item) => ({
          ...item,
          date: item.date || todayDateString(),
        })),
        finalPaymentAmount: parseAmount(finalPaymentAmount),
        finalPaymentDate:
          parseAmount(finalPaymentAmount) > 0 ? finalPaymentDate.trim() || todayDateString() : null,
      });
      if (cutter || tailor || extraStaffTypes.some((role) => extraAssign[role.slug])) {
        let jobs = jobsFromLegacyColumns(cloth);
        if (cutter && cloth.cutterId) {
          jobs = upsertStaffJob(jobs, {
            type: 'cutter',
            staffId: cloth.cutterId,
            amount: cutterPay.amount,
            advance: cutterPay.advance,
            final: cutterPay.final,
            remarks: cutterPay.remarks,
          });
        }
        if (tailor && cloth.tailorId) {
          jobs = upsertStaffJob(jobs, {
            type: 'tailor',
            staffId: cloth.tailorId,
            amount: tailorPay.amount,
            advance: tailorPay.advance,
            final: tailorPay.final,
            remarks: tailorPay.remarks,
          });
        }
        for (const role of extraStaffTypes) {
          const staffId = extraAssign[role.slug] || null;
          const pay = extraPay[role.slug];
          jobs = upsertStaffJob(jobs, {
            type: role.slug,
            staffId,
            amount: pay?.amount ?? staffRateForGarment(cloth.garmentType, role.slug),
            advance: pay?.advance ?? 0,
            final: pay?.final ?? 0,
            remarks: pay?.remarks ?? '',
          });
        }
        await writeStaffJobs(cloth.id, jobs);
      }
      onUpdated();
      showToast('Saved');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-2xl sm:rounded-3xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-indigo-600">{cloth.code}</p>
            <p className="font-semibold text-slate-900">{cloth.customerName}</p>
            <p className="text-sm text-slate-500">
              {clothDescription(previewCloth)}
              {groupQty > 1 ? ` · Qty ${groupQty}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={CLOTH_STATUS_COLORS[status]}>
              {CLOTH_STATUS_LABELS[status]}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 space-y-1 text-sm text-slate-600">
          {cutter && <p>Cutter: <strong>{cutter.name}</strong></p>}
          {tailor && <p>Tailor: <strong>{tailor.name}</strong></p>}
          {extraJobs.map((job) => {
            const member = getStaffById(staff, job.staffId);
            if (!member) return null;
            return (
              <p key={job.type}>
                {staffTypeLabel(job.type)}: <strong>{member.name}</strong>
              </p>
            );
          })}
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Cloth & Measurements</p>
            <div className="mb-3">
              <Input
                label="Mobile number"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>
            <GarmentSizingForm
              value={sizing}
              onChange={setSizing}
              afterClothType={
                <Input
                  label="Qty"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              }
            />
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Dates</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Order date"
                type="date"
                value={givenDate}
                onChange={(e) => setGivenDate(e.target.value)}
              />
              <Input
                label="Delivery date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={givenDate || undefined}
              />
              <Input
                label="Cutter Expected"
                type="date"
                value={cutterExpectedDate}
                onChange={(e) => setCutterExpectedDate(e.target.value)}
              />
              <Input
                label="Tailor Expected"
                type="date"
                value={tailorExpectedDate}
                onChange={(e) => setTailorExpectedDate(e.target.value)}
              />
            </div>
            {(givenDate || deliveryDate || cutterExpectedDate || tailorExpectedDate) && (
              <p className="mt-2 text-xs text-slate-500">
                {givenDate && <>Order: {formatCalendarDate(givenDate)}</>}
                {deliveryDate && (
                  <>
                    {givenDate && ' · '}
                    Delivery: {formatCalendarDate(deliveryDate)}
                  </>
                )}
                {cutterExpectedDate && (
                  <>
                    {(givenDate || deliveryDate) && ' · '}
                    <span className={cutterOverdue ? 'font-semibold text-rose-600' : ''}>
                      Cutter by: {formatCalendarDate(cutterExpectedDate)}
                      {cutterOverdue ? ' (overdue)' : ''}
                    </span>
                  </>
                )}
                {tailorExpectedDate && (
                  <>
                    {(givenDate || deliveryDate || cutterExpectedDate) && ' · '}
                    <span className={tailorOverdue ? 'font-semibold text-rose-600' : ''}>
                      Tailor by: {formatCalendarDate(tailorExpectedDate)}
                      {tailorOverdue ? ' (overdue)' : ''}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Customer Payment</p>
            <div className="space-y-3">
              <Input
                label="Total Amount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="e.g. 2500"
              />
              <Input
                label="Discount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Advance Paid (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="e.g. 1000"
                />
                <Input
                  label="Advance date"
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Part Payment</p>
                {partPaymentDrafts.map((row, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
                      <Input
                        label={index === 0 ? 'Amount (₹)' : '\u00a0'}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => {
                          const next = [...partPaymentDrafts];
                          next[index] = { ...row, amount: event.target.value };
                          setPartPaymentDrafts(next);
                        }}
                        placeholder="e.g. 500"
                      />
                      <Input
                        label={index === 0 ? 'Date' : '\u00a0'}
                        type="date"
                        value={row.date}
                        onChange={(event) => {
                          const next = [...partPaymentDrafts];
                          next[index] = { ...row, date: event.target.value };
                          setPartPaymentDrafts(next);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = partPaymentDrafts.filter((_, itemIndex) => itemIndex !== index);
                        setPartPaymentDrafts(
                          next.length > 0 ? next : [emptyPartPaymentDraft(todayDateString())],
                        );
                      }}
                      disabled={partPaymentDrafts.length === 1 && !row.amount}
                      className="mb-1 inline-flex h-[46px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Remove part payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setPartPaymentDrafts([
                      ...partPaymentDrafts,
                      emptyPartPaymentDraft(todayDateString()),
                    ])
                  }
                  className="rounded-lg px-3 py-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add part payment
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Final Payment (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalPaymentAmount}
                  onChange={(e) => setFinalPaymentAmount(e.target.value)}
                  placeholder="Paid on delivery"
                />
                <Input
                  label="Final date"
                  type="date"
                  value={finalPaymentDate}
                  onChange={(e) => setFinalPaymentDate(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm">
                <span className="text-slate-500">Net bill: </span>
                <strong className="text-slate-900">{formatCurrency(clothNetAmount(preview))}</strong>
                <span className="mx-2 text-slate-300">·</span>
                <span className="text-slate-500">Pending: </span>
                <strong className="text-amber-700">{formatCurrency(clothPendingAmount(preview))}</strong>
              </div>
            </div>
          </div>

          {(cutter || tailor || extraStaffTypes.some((role) => staff.some((member) => member.type === role.slug))) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">Staff Payment</p>
              <div className="space-y-4">
                {cutter && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                      Cutter: {cutter.name}
                    </p>
                    <StaffPayForm pay={cutterPay} onChange={setCutterPay} />
                  </div>
                )}
                {tailor && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-700">
                      Tailor: {tailor.name}
                    </p>
                    <StaffPayForm pay={tailorPay} onChange={setTailorPay} />
                  </div>
                )}
                {extraStaffTypes.map((role) => {
                  const members = staff.filter((member) => member.type === role.slug);
                  if (members.length === 0) return null;
                  const staffId = extraAssign[role.slug] ?? '';
                  const member = getStaffById(staff, staffId);
                  const pay = extraPay[role.slug] ?? {
                    amount: staffRateForGarment(cloth.garmentType, role.slug),
                    advance: 0,
                    final: 0,
                    remarks: '',
                  };
                  return (
                    <div key={role.slug}>
                      <Select
                        label={role.label}
                        value={staffId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setExtraAssign((current) => ({ ...current, [role.slug]: nextId }));
                          setExtraPay((current) => ({
                            ...current,
                            [role.slug]: {
                              amount: nextId
                                ? current[role.slug]?.amount ||
                                  staffRateForGarment(cloth.garmentType, role.slug)
                                : 0,
                              advance: current[role.slug]?.advance ?? 0,
                              final: current[role.slug]?.final ?? 0,
                              remarks: current[role.slug]?.remarks ?? '',
                            },
                          }));
                        }}
                      >
                        <option value="">Not assigned</option>
                        {members.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </Select>
                      {member && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-700">
                            {role.label}: {member.name}
                          </p>
                          <StaffPayForm
                            pay={pay}
                            onChange={(next) =>
                              setExtraPay((current) => ({ ...current, [role.slug]: next }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <PaymentSummary cloth={preview} />

          <p className="text-center text-xs text-slate-500">
            Scan barcode to mark cutting / sewing complete or assign tailor.
          </p>

          <Button variant="secondary" className="w-full rounded-full py-3" onClick={onShowBarcode}>
            View / Print Barcode
          </Button>
        </div>
        </div>
        <div className="border-t border-slate-100 bg-white p-4">
          <Button
            className="w-full rounded-full py-3.5"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            <Save className="h-4 w-4" />
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

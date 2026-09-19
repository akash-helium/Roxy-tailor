import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, X } from 'lucide-react';
import type { Cloth, Staff } from '../types';
import { getStaffById, updateClothPayments, updateClothStaffPayments, updateClothDates, updateClothMeasurements } from '../lib/data';
import { clothPendingAmount, clothNetAmount, formatCurrency, parseAmount, parsePartPaymentDrafts, emptyPartPaymentDraft } from '../lib/payments';
import { formatCalendarDate, isPastDue, clothDescription, todayDateString } from '../lib/utils';
import { garmentDisplayLabel, getGarmentType } from '../lib/garments';
import { formatMeasurementsSummary } from '../lib/measurements';
import { groupClothsForStaffTickets } from '../lib/customer-order';
import { StaffPayForm } from './StaffPaymentSheet';
import { GarmentSizingForm } from './GarmentSizingForm';
import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
} from '../types';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { PaymentSummary } from './PaymentDashboard';
import { Badge, Button, Input } from './ui';

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
  const [staffBusy, setStaffBusy] = useState(false);
  const [datesBusy, setDatesBusy] = useState(false);
  const [sizeBusy, setSizeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSaveSizing() {
    setSizeBusy(true);
    setError(null);
    const garmentType = getGarmentType(sizing.garmentType);
    if (!garmentType) {
      setError('Please select a cloth type');
      setSizeBusy(false);
      return;
    }
    try {
      await updateClothMeasurements(cloth.id, {
        garment: garmentDisplayLabel(sizing.garmentType, garmentType.label),
        garmentType: sizing.garmentType,
        gender: sizing.gender,
        size: formatMeasurementsSummary(sizing.garmentType, sizing.measurements),
        measurements: sizing.measurements,
        inGroup: sizing.inGroup,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sizing');
    } finally {
      setSizeBusy(false);
    }
  }

  async function handleSavePayments() {
    setBusy(true);
    setError(null);
    const total = parseAmount(totalAmount);
    const discount = parseAmount(discountAmount);
    if (discount > total) {
      setError('Discount cannot exceed total amount');
      setBusy(false);
      return;
    }
    try {
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
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payments');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveStaffPayments() {
    setStaffBusy(true);
    setError(null);
    try {
      await updateClothStaffPayments(cloth.id, {
        cutterPayAmount: cutterPay.amount,
        cutterPayAdvance: cutterPay.advance,
        cutterPayFinal: cutterPay.final,
        cutterPayRemarks: cutterPay.remarks,
        tailorPayAmount: tailorPay.amount,
        tailorPayAdvance: tailorPay.advance,
        tailorPayFinal: tailorPay.final,
        tailorPayRemarks: tailorPay.remarks,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff payments');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleSaveDates() {
    setDatesBusy(true);
    setError(null);
    try {
      await updateClothDates(cloth.id, {
        givenDate: givenDate.trim() || null,
        deliveryDate: deliveryDate.trim() || null,
        cutterExpectedDate: cutterExpectedDate.trim() || null,
        tailorExpectedDate: tailorExpectedDate.trim() || null,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dates');
    } finally {
      setDatesBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-indigo-600">{cloth.code}</p>
            <p className="font-semibold text-slate-900">{cloth.customerName}</p>
            {cloth.customerPhone ? (
              <p className="text-xs text-slate-500">{cloth.customerPhone}</p>
            ) : null}
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
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Cloth & Measurements</p>
            <GarmentSizingForm
              value={sizing}
              onChange={setSizing}
              afterClothType={
                <Input
                  label="Qty"
                  type="number"
                  value={groupQty}
                  readOnly
                />
              }
            />
            <Button
              className="mt-4 w-full rounded-full py-3"
              disabled={sizeBusy}
              onClick={() => void handleSaveSizing()}
            >
              <Save className="h-4 w-4" />
              {sizeBusy ? 'Saving...' : 'Save Cloth & Measurements'}
            </Button>
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
            <Button
              className="mt-4 w-full rounded-full py-3"
              disabled={datesBusy}
              onClick={() => void handleSaveDates()}
            >
              <Save className="h-4 w-4" />
              {datesBusy ? 'Saving...' : 'Save Dates'}
            </Button>
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
            <Button
              className="mt-4 w-full rounded-full py-3"
              disabled={busy}
              onClick={() => void handleSavePayments()}
            >
              <Save className="h-4 w-4" />
              {busy ? 'Saving...' : 'Save Payment'}
            </Button>
          </div>

          {(cutter || tailor) && (
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
              </div>
              <Button
                className="mt-4 w-full rounded-full py-3"
                disabled={staffBusy}
                onClick={() => void handleSaveStaffPayments()}
              >
                <Save className="h-4 w-4" />
                {staffBusy ? 'Saving...' : 'Save Staff Payment'}
              </Button>
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
    </div>,
    document.body,
  );
}

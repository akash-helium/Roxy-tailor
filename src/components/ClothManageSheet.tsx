import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, X } from 'lucide-react';
import type { Cloth, Staff } from '../types';
import { getStaffById, updateClothPayments, updateClothDates, updateClothMeasurements, updateClothNotes, updateClothCustomerPhone, adjustClothQuantity, writeStaffJobs, assignCutter, assignTailor } from '../lib/data';
import { normalizeCustomerPhone } from '../lib/whatsapp';
import { parseAmount, parsePartPaymentDrafts, emptyPartPaymentDraft } from '../lib/payments';
import { cn, formatCalendarDate, isPastDue, clothBillName, todayDateString } from '../lib/utils';
import { garmentDisplayLabel, getGarmentType } from '../lib/garments';
import { formatMeasurementsSummary } from '../lib/measurements';
import { groupClothsForStaffTickets } from '../lib/customer-order';
import { jobsFromLegacyColumns, staffRateForGarment, upsertStaffJob } from '../lib/staff-jobs';
import { StaffPayForm } from './StaffPaymentSheet';
import { GarmentSizingForm } from './GarmentSizingForm';
import { clothStageBadge } from '../lib/cloth-status';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { PaymentSummary } from './PaymentDashboard';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import { latestSizingForCustomer } from '../lib/customer-history';
import { Badge, Button, Input, Select, Textarea, showToast } from './ui';

export function ClothManageSheet({
  cloth,
  orderCloths,
  allCloths,
  staff,
  onClose,
  onUpdated,
  onShowBarcode,
}: {
  cloth: Cloth;
  orderCloths?: Cloth[];
  allCloths?: Cloth[];
  staff: Staff[];
  onClose: () => void;
  onUpdated: () => void;
  onShowBarcode: () => void;
}) {
  const pieces = useMemo(() => {
    const list = orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
    return [...list].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [orderCloths, cloth]);
  const [activeId, setActiveId] = useState(cloth.id);
  const pieceIds = pieces.map((item) => item.id).join('|');
  const [customerPhone, setCustomerPhone] = useState(cloth.customerPhone ?? '');

  useEffect(() => {
    setActiveId((current) => (pieces.some((item) => item.id === current) ? current : cloth.id));
  }, [cloth.id, pieceIds, pieces]);

  const active = pieces.find((item) => item.id === activeId) ?? cloth;
  const isMulti = pieces.length > 1;

  useEffect(() => {
    setCustomerPhone(
      pieces.find((item) => item.customerPhone?.trim())?.customerPhone ?? cloth.customerPhone ?? '',
    );
  }, [pieceIds, cloth.customerPhone, cloth, pieces]);

  return (
    <ClothManageEditor
      cloth={active}
      orderCloths={pieces}
      allCloths={allCloths ?? pieces}
      staff={staff}
      customerPhone={customerPhone}
      onCustomerPhoneChange={setCustomerPhone}
      onClose={onClose}
      onUpdated={onUpdated}
      onShowBarcode={onShowBarcode}
      piecePicker={
        isMulti ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Clothes in this order
            </p>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Clothes in this order">
              {pieces.map((piece) => {
                const selected = piece.id === active.id;
                return (
                  <button
                    key={piece.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveId(piece.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-left',
                      selected
                        ? 'border-action bg-action text-white'
                        : 'border-seam bg-white text-ink hover:bg-paper',
                    )}
                  >
                    <span className="font-mono text-[11px] font-semibold">{piece.code}</span>
                    <span className={cn('ms-1.5 text-xs', selected ? 'text-white/85' : 'text-ink-muted')}>
                      {clothBillName(piece)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null
      }
    />
  );
}

function ClothManageEditor({
  cloth,
  orderCloths,
  allCloths,
  staff,
  customerPhone,
  onCustomerPhoneChange,
  onClose,
  onUpdated,
  onShowBarcode,
  piecePicker,
}: {
  cloth: Cloth;
  orderCloths?: Cloth[];
  allCloths: Cloth[];
  staff: Staff[];
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  onClose: () => void;
  onUpdated: () => void;
  onShowBarcode: () => void;
  piecePicker?: ReactNode;
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
  const [cutterId, setCutterId] = useState(cloth.cutterId ?? '');
  const [tailorId, setTailorId] = useState(cloth.tailorId ?? '');
  const [notes, setNotes] = useState(cloth.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
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

  useEffect(() => {
    const jobs = jobsFromLegacyColumns(cloth).filter(
      (job) => job.type !== 'cutter' && job.type !== 'tailor',
    );
    setTotalAmount(String(cloth.totalAmount || ''));
    setDiscountAmount(String(cloth.discountAmount || ''));
    setAdvanceAmount(String(cloth.advanceAmount || ''));
    setAdvanceDate(
      cloth.advanceDate || (cloth.advanceAmount ? cloth.givenDate ?? todayDateString() : ''),
    );
    setPartPaymentDrafts(
      (cloth.partPayments ?? []).length > 0
        ? cloth.partPayments.map((item) => ({ amount: String(item.amount), date: item.date || '' }))
        : [emptyPartPaymentDraft(todayDateString())],
    );
    setFinalPaymentAmount(String(cloth.finalPaymentAmount || ''));
    setFinalPaymentDate(cloth.finalPaymentDate || '');
    setCutterPay({
      amount: cloth.cutterPayAmount,
      advance: cloth.cutterPayAdvance,
      final: cloth.cutterPayFinal,
      remarks: cloth.cutterPayRemarks,
    });
    setTailorPay({
      amount: cloth.tailorPayAmount,
      advance: cloth.tailorPayAdvance,
      final: cloth.tailorPayFinal,
      remarks: cloth.tailorPayRemarks,
    });
    setSizing({
      garmentType: cloth.garmentType ?? '',
      gender: cloth.gender ?? 'male',
      measurements: cloth.measurements ?? {},
      inGroup: cloth.inGroup ?? false,
    });
    setGivenDate(cloth.givenDate ?? '');
    setDeliveryDate(cloth.deliveryDate ?? '');
    setCutterExpectedDate(cloth.cutterExpectedDate ?? '');
    setTailorExpectedDate(cloth.tailorExpectedDate ?? '');
    setCutterId(cloth.cutterId ?? '');
    setTailorId(cloth.tailorId ?? '');
    setNotes(cloth.notes ?? '');
    setError(null);
    setExtraAssign(Object.fromEntries(jobs.map((job) => [job.type, job.staffId])));
    setExtraPay(
      Object.fromEntries(
        jobs.map((job) => [
          job.type,
          { amount: job.amount, advance: job.advance, final: job.final, remarks: job.remarks },
        ]),
      ),
    );
  }, [cloth.id]);

  const cutter = getStaffById(staff, cutterId || null);
  const tailor = getStaffById(staff, tailorId || null);
  const cutters = staff.filter((member) => member.type === 'cutter');
  const tailors = staff.filter((member) => member.type === 'tailor');
  const status = cloth.status;
  const stage = clothStageBadge({ status, cutterId });
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
  }, [cloth.id, groupQty]);

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
      const nextNotes = notes.trim();
      await updateClothMeasurements(cloth.id, {
        garment: garmentLabel,
        garmentType: sizing.garmentType,
        gender: sizing.gender,
        size: sizeSummary,
        measurements: sizing.measurements,
        inGroup: sizing.inGroup,
      });
      await updateClothNotes(cloth.id, nextNotes);
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
          notes: nextNotes,
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
      await assignCutter(cloth.id, cutterId || null);
      await assignTailor(cloth.id, tailorId || null, tailorExpectedDate.trim() || null, {
        startSewing: (cloth.status === 'ready_to_sew' || cloth.status === 'sewing') && Boolean(tailorId),
      });
      let jobs = jobsFromLegacyColumns(cloth);
      jobs = upsertStaffJob(jobs, {
        type: 'cutter',
        staffId: cutterId || null,
        amount: cutterId ? cutterPay.amount || staffRateForGarment(sizing.garmentType, 'cutter') : 0,
        advance: cutterId ? cutterPay.advance : 0,
        final: cutterId ? cutterPay.final : 0,
        remarks: cutterId ? cutterPay.remarks : '',
      });
      jobs = upsertStaffJob(jobs, {
        type: 'tailor',
        staffId: tailorId || null,
        amount: tailorId ? tailorPay.amount || staffRateForGarment(sizing.garmentType, 'tailor') : 0,
        advance: tailorId ? tailorPay.advance : 0,
        final: tailorId ? tailorPay.final : 0,
        remarks: tailorId ? tailorPay.remarks : '',
      });
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
      onUpdated();
      showToast(pieceCount > 1 ? `Saved ${cloth.code}` : 'Saved');
      if (pieceCount <= 1) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  const pieceCount = orderCloths && orderCloths.length > 0 ? orderCloths.length : 1;
  const isMulti = pieceCount > 1;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="ticket relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[18px] sm:max-h-[min(92dvh,900px)] sm:w-[min(72rem,calc(100vw-3rem))] sm:rounded-[18px]"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== 'NumpadEnter') return;
          if (event.target instanceof HTMLTextAreaElement) return;
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold tracking-wide text-ink">
              {(orderCloths?.find((item) => item.orderCode)?.orderCode || cloth.orderCode || 'Order').trim()}
              <span className="ml-2 font-sans text-sm font-medium text-ink-muted">{cloth.code}</span>
            </p>
            <p className="truncate font-semibold text-ink">{cloth.customerName}</p>
            <p className="truncate text-sm text-ink-muted">
              {isMulti
                ? `${pieceCount} clothes · editing ${cloth.code}`
                : `${clothBillName(previewCloth)}${groupQty > 1 ? ` · Qty ${groupQty}` : ''}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className={`max-w-[9rem] truncate ${stage.className}`}>
              {stage.label}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-ink-muted hover:bg-paper"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-[14px] border border-seam bg-white p-3 sm:p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Customer</p>
          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="9876543210"
          />
        </div>

        {piecePicker ? <div className="mb-4">{piecePicker}</div> : null}

        {isMulti && (
          <p className="mb-3 text-sm font-semibold text-ink">
            {cloth.code}
            <span className="ms-2 font-sans font-medium text-ink-muted">{clothBillName(previewCloth)}</span>
          </p>
        )}

          {(cutter || tailor || extraStaffTypes.some((role) => extraAssign[role.slug])) && (
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
              {cutter && <p>Cutter: <strong className="text-ink">{cutter.name}</strong></p>}
              {tailor && <p>Tailor: <strong className="text-ink">{tailor.name}</strong></p>}
              {extraJobs.map((job) => {
                const member = getStaffById(staff, extraAssign[job.type] || job.staffId);
                if (!member) return null;
                return (
                  <p key={job.type}>
                    {staffTypeLabel(job.type)}: <strong className="text-ink">{member.name}</strong>
                  </p>
                );
              })}
            </div>
          )}

        {error && (
          <p className="mb-4 rounded-[10px] bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</p>
        )}

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-3">
          <div className="rounded-[14px] border border-seam bg-paper/70 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">
              {isMulti ? `Measurements · ${cloth.code}` : 'Cloth & Measurements'}
            </p>
            <GarmentSizingForm
              layout="wide"
              value={sizing}
              rememberedSizing={(garmentType) =>
                latestSizingForCustomer(allCloths, cloth.customerName, customerPhone, garmentType)
              }
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
            <div className="mt-3">
              <Textarea
                label="Special note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instructions for this cloth (prints on the staff ticket)"
              />
            </div>
          </div>

          <div className="rounded-[14px] border border-ready/20 bg-ready/5 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Dates</p>
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
          </div>

          <div className="space-y-3">
          <div className="rounded-[14px] border border-done/20 bg-done/5 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">
              {isMulti ? `Payment · ${cloth.code}` : 'Customer Payment'}
            </p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
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
            </div>
          </div>

          <div className="rounded-[14px] border border-action/20 bg-action/5 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">Staff</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Cutter"
                    value={cutterId}
                    searchable={false}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setCutterId(nextId);
                      setCutterPay((current) => ({
                        ...current,
                        amount: nextId
                          ? current.amount || staffRateForGarment(sizing.garmentType, 'cutter')
                          : 0,
                      }));
                    }}
                  >
                    <option value="">None</option>
                    {cutters.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Tailor"
                    value={tailorId}
                    searchable={false}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setTailorId(nextId);
                      setTailorPay((current) => ({
                        ...current,
                        amount: nextId
                          ? current.amount || staffRateForGarment(sizing.garmentType, 'tailor')
                          : 0,
                      }));
                    }}
                  >
                    <option value="">None</option>
                    {tailors.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </div>
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
                        searchable={false}
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
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-action">
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

          <PaymentSummary cloth={preview} />

          <p className="text-center text-xs text-ink-muted">
            Scan barcode to mark cutting / sewing complete or assign tailor.
          </p>

          <Button variant="secondary" className="w-full py-3" onClick={onShowBarcode}>
            View / Print Barcode
          </Button>
          </div>
        </div>
        </div>
        <div className="border-t border-seam bg-ticket p-4 sm:px-6">
          <Button
            className="w-full py-3.5"
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

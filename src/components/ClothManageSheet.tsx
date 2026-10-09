import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Save, Plus, Trash2, X } from "lucide-react";
import type { Cloth, Staff } from "../types";
import {
  getStaffById,
  updateClothPayments,
  updateClothDates,
  updateClothMeasurements,
  updateClothNotes,
  updateClothCustomerPhone,
  adjustClothQuantity,
  writeStaffJobs,
  assignCutter,
  assignTailor,
} from "../lib/data";
import { normalizeCustomerPhone } from "../lib/whatsapp";
import {
  parseAmount,
  parsePartPaymentDrafts,
  emptyPartPaymentDraft,
  formatCurrency,
  mergeOrderPartPayments,
} from "../lib/payments";
import {
  cn,
  formatCalendarDate,
  isPastDue,
  clothBillName,
  todayDateString,
} from "../lib/utils";
import { garmentDisplayLabel, getGarmentType } from "../lib/garments";
import { formatMeasurementsSummary } from "../lib/measurements";
import {
  groupClothsForStaffTickets,
  staffTicketGroupKey,
} from "../lib/customer-order";
import {
  jobsFromLegacyColumns,
  staffRateForGarment,
  upsertStaffJob,
} from "../lib/staff-jobs";
import { StaffPayForm } from "./StaffPaymentSheet";
import { GarmentSizingForm } from "./GarmentSizingForm";
import { clothStageBadge } from "../lib/cloth-status";
import { useAndroidBackHandler } from "../hooks/useAndroidBackHandler";
import { PaymentSummary } from "./PaymentDashboard";
import { useStaffTypes } from "../contexts/StaffTypesContext";
import { latestSizingForCustomer } from "../lib/customer-history";
import { Badge, Button, Input, Select, Textarea, showToast } from "./ui";

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
    return [...list].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
  }, [orderCloths, cloth]);
  const [activeId, setActiveId] = useState(cloth.id);
  const pieceIds = pieces.map((item) => item.id).join("|");
  const [customerPhone, setCustomerPhone] = useState(cloth.customerPhone ?? "");

  useEffect(() => {
    setActiveId((current) => {
      const group = groupClothsForStaffTickets(pieces).find((items) =>
        items.some((item) => item.id === current),
      );
      if (group?.[0]) return group[0].id;
      return pieces.some((item) => item.id === cloth.id) ? cloth.id : (pieces[0]?.id ?? cloth.id);
    });
  }, [cloth.id, pieceIds, pieces]);

  const lineGroups = useMemo(
    () => groupClothsForStaffTickets(pieces),
    [pieces],
  );
  const active = pieces.find((item) => item.id === activeId) ?? cloth;
  const isMulti = lineGroups.length > 1;

  useEffect(() => {
    setCustomerPhone(
      pieces.find((item) => item.customerPhone?.trim())?.customerPhone ??
        cloth.customerPhone ??
        "",
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
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Clothes in this order"
            >
              {lineGroups.map((group) => {
                const primary = group[0]!;
                const selected = group.some((item) => item.id === active.id);
                const qty = group.length;
                return (
                  <button
                    key={staffTicketGroupKey(primary)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveId(primary.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-left",
                      selected
                        ? "border-action bg-action text-white"
                        : "border-seam bg-white text-ink hover:bg-paper",
                    )}
                  >
                    <span className="font-mono text-[11px] font-semibold">
                      {primary.code}
                    </span>
                    <span
                      className={cn(
                        "ms-1.5 text-xs",
                        selected ? "text-white/85" : "text-ink-muted",
                      )}
                    >
                      {clothBillName(primary)}
                      {qty > 1 ? ` x${qty}` : ""}
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

function looksLikeSharedOrderTotal(pieces: Cloth[]) {
  if (pieces.length < 2) return false;
  const groups = groupClothsForStaffTickets(pieces);
  const withMoney = pieces.filter((item) => (item.totalAmount || 0) > 0);
  if (withMoney.length <= 1) return true;
  if (groups.length < 2) return false;
  const sample = withMoney[0]!.totalAmount;
  return withMoney.every((item) => Math.abs((item.totalAmount || 0) - sample) < 0.05);
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
  const [linePrices, setLinePrices] = useState<Record<string, string>>({});
  const [lumpTotal, setLumpTotal] = useState('');
  const [discountAmount, setDiscountAmount] = useState(
    String(cloth.discountAmount || ""),
  );
  const [advanceAmount, setAdvanceAmount] = useState(
    String(cloth.advanceAmount || ""),
  );
  const [advanceDate, setAdvanceDate] = useState(
    cloth.advanceDate ||
      (cloth.advanceAmount ? (cloth.givenDate ?? todayDateString()) : ""),
  );
  const [partPaymentDrafts, setPartPaymentDrafts] = useState(
    (cloth.partPayments ?? []).length > 0
      ? cloth.partPayments.map((item) => ({
          amount: String(item.amount),
          date: item.date || "",
        }))
      : [emptyPartPaymentDraft(todayDateString())],
  );
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(
    String(cloth.finalPaymentAmount || ""),
  );
  const [finalPaymentDate, setFinalPaymentDate] = useState(
    cloth.finalPaymentDate || "",
  );
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
    garmentType: cloth.garmentType ?? "",
    gender: cloth.gender ?? "male",
    measurements: cloth.measurements ?? {},
    inGroup: cloth.inGroup ?? false,
  });
  const [givenDate, setGivenDate] = useState(cloth.givenDate ?? "");
  const [deliveryDate, setDeliveryDate] = useState(cloth.deliveryDate ?? "");
  const [cutterExpectedDate, setCutterExpectedDate] = useState(
    cloth.cutterExpectedDate ?? "",
  );
  const [tailorExpectedDate, setTailorExpectedDate] = useState(
    cloth.tailorExpectedDate ?? "",
  );
  const [cutterId, setCutterId] = useState(cloth.cutterId ?? "");
  const [tailorId, setTailorId] = useState(cloth.tailorId ?? "");
  const [notes, setNotes] = useState(cloth.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, number>>({});
  const { types: staffRoleTypes, getLabel: staffTypeLabel } = useStaffTypes();
  const extraStaffTypes = staffRoleTypes.filter(
    (item) => item.slug !== "cutter" && item.slug !== "tailor",
  );
  const extraJobs = jobsFromLegacyColumns(cloth).filter(
    (job) => job.type !== "cutter" && job.type !== "tailor",
  );
  const [extraAssign, setExtraAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries(extraJobs.map((job) => [job.type, job.staffId])),
  );
  const [extraPay, setExtraPay] = useState<
    Record<
      string,
      { amount: number; advance: number; final: number; remarks: string }
    >
  >(() =>
    Object.fromEntries(
      extraJobs.map((job) => [
        job.type,
        {
          amount: job.amount,
          advance: job.advance,
          final: job.final,
          remarks: job.remarks,
        },
      ]),
    ),
  );

  const orderPieces =
    orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
  const orderKey = orderPieces.map((item) => item.id).join("|");
  const billLines = useMemo(
    () =>
      groupClothsForStaffTickets(orderPieces).map((group) => {
        const primary = group[0]!;
        const key = staffTicketGroupKey(primary);
        const storedQty = group.length;
        const qty = qtyDrafts[key] ?? storedQty;
        const name = clothBillName(primary);
        return {
          key,
          title: qty > 1 ? `${name} x${qty}` : name,
          qty,
          storedQty,
          pieces: group,
          stored: group.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
        };
      }),
    [orderPieces, qtyDrafts],
  );
  const activeLineKey = useMemo(() => {
    const group = groupClothsForStaffTickets(orderPieces).find((items) =>
      items.some((item) => item.id === cloth.id),
    );
    return group?.[0] ? staffTicketGroupKey(group[0]) : "";
  }, [orderPieces, cloth.id]);

  useEffect(() => {
    const jobs = jobsFromLegacyColumns(cloth).filter(
      (job) => job.type !== "cutter" && job.type !== "tailor",
    );
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
      garmentType: cloth.garmentType ?? "",
      gender: cloth.gender ?? "male",
      measurements: cloth.measurements ?? {},
      inGroup: cloth.inGroup ?? false,
    });
    setGivenDate(cloth.givenDate ?? "");
    setDeliveryDate(cloth.deliveryDate ?? "");
    setCutterExpectedDate(cloth.cutterExpectedDate ?? "");
    setTailorExpectedDate(cloth.tailorExpectedDate ?? "");
    setCutterId(cloth.cutterId ?? "");
    setTailorId(cloth.tailorId ?? "");
    setNotes(cloth.notes ?? "");
    setError(null);
    setExtraAssign(
      Object.fromEntries(jobs.map((job) => [job.type, job.staffId])),
    );
    setExtraPay(
      Object.fromEntries(
        jobs.map((job) => [
          job.type,
          {
            amount: job.amount,
            advance: job.advance,
            final: job.final,
            remarks: job.remarks,
          },
        ]),
      ),
    );
  }, [cloth.id]);

  useEffect(() => {
    const lines = groupClothsForStaffTickets(orderPieces).map((group) => {
      const stored = group.reduce(
        (sum, item) => sum + (item.totalAmount || 0),
        0,
      );
      return {
        key: staffTicketGroupKey(group[0]!),
        stored,
        qty: group.length,
      };
    });
    const lump = looksLikeSharedOrderTotal(orderPieces);
    const bill = orderPieces.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    setLumpTotal(bill > 0 ? String(bill) : '');
    setLinePrices(
      Object.fromEntries(
        lines.map((line) => {
          if (lump) return [line.key, ''];
          const unit =
            line.qty > 0 ? Math.round((line.stored / line.qty) * 100) / 100 : line.stored;
          return [line.key, unit > 0 ? String(unit) : ''];
        }),
      ),
    );
    setQtyDrafts(Object.fromEntries(lines.map((line) => [line.key, line.qty])));
    const discount = orderPieces.reduce(
      (sum, item) => sum + (item.discountAmount ?? 0),
      0,
    );
    const advance = orderPieces.reduce(
      (sum, item) => sum + (item.advanceAmount || 0),
      0,
    );
    const finalPaid = orderPieces.reduce(
      (sum, item) => sum + (item.finalPaymentAmount || 0),
      0,
    );
    setDiscountAmount(discount > 0 ? String(discount) : "");
    setAdvanceAmount(advance > 0 ? String(advance) : "");
    const advanceRow = orderPieces.find(
      (item) => item.advanceDate || item.advanceAmount,
    );
    setAdvanceDate(
      advanceRow?.advanceDate ||
        (advance > 0 ? (advanceRow?.givenDate ?? todayDateString()) : ""),
    );
    const merged = mergeOrderPartPayments(orderPieces);
    setPartPaymentDrafts(
      merged.length > 0
        ? merged.map((item) => ({
            amount: String(item.amount),
            date: item.date || "",
          }))
        : [emptyPartPaymentDraft(todayDateString())],
    );
    setFinalPaymentAmount(finalPaid > 0 ? String(finalPaid) : "");
    setFinalPaymentDate(
      orderPieces.find((item) => item.finalPaymentDate)?.finalPaymentDate || "",
    );
  }, [orderKey]);

  const cutter = getStaffById(staff, cutterId || null);
  const tailor = getStaffById(staff, tailorId || null);
  const cutters = staff.filter((member) => member.type === "cutter");
  const tailors = staff.filter((member) => member.type === "tailor");
  const status = cloth.status;
  const stage = clothStageBadge({ status, cutterId });
  const cutterOverdue =
    status === "cutting" && isPastDue(cutterExpectedDate || null, false);
  const tailorOverdue =
    status === "sewing" && isPastDue(tailorExpectedDate || null, false);
  const groupQty = useMemo(() => {
    const list = orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
    const group = groupClothsForStaffTickets(list).find((items) =>
      items.some((item) => item.id === cloth.id),
    );
    return group?.length ?? 1;
  }, [orderCloths, cloth]);

  function applyLineQty(lineKey: string, nextQty: number) {
    const qty = Math.min(50, Math.max(1, nextQty));
    setQtyDrafts((current) => ({ ...current, [lineKey]: qty }));
  }

  useEffect(() => {
    const group = groupClothsForStaffTickets(orderPieces).find((items) =>
      items.some((item) => item.id === cloth.id),
    );
    const key = group?.[0] ? staffTicketGroupKey(group[0]) : "";
    setQuantity(String(qtyDrafts[key] ?? group?.length ?? 1));
    // Only when switching the active cloth — qty typing updates drafts separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cloth.id is the switch signal
  }, [cloth.id]);

  useAndroidBackHandler(onClose);

  const orderMoney = useMemo(() => {
    const units = Object.fromEntries(
      billLines.map((line) => [line.key, parseAmount(linePrices[line.key] ?? '')]),
    );
    const anyEach = billLines.some((line) => (units[line.key] ?? 0) > 0);
    const lineAmounts = Object.fromEntries(
      billLines.map((line) => [
        line.key,
        Math.round((units[line.key] ?? 0) * line.qty * 100) / 100,
      ]),
    );
    const pricedTotal = billLines.reduce((sum, line) => sum + (lineAmounts[line.key] ?? 0), 0);
    const total = anyEach ? pricedTotal : parseAmount(lumpTotal);
    const discount = parseAmount(discountAmount);
    const advance = parseAmount(advanceAmount);
    const parts = parsePartPaymentDrafts(partPaymentDrafts).map((item) => ({
      ...item,
      date: item.date || todayDateString(),
    }));
    const partTotal = parts.reduce((sum, item) => sum + item.amount, 0);
    const net = Math.max(0, total - discount);
    const remainingBeforeFinal = Math.max(
      0,
      Math.round((net - advance - partTotal) * 100) / 100,
    );
    const finalAmt = parseAmount(finalPaymentAmount);
    return {
      units,
      lineAmounts,
      anyEach,
      total,
      discount,
      advance,
      parts,
      partTotal,
      net,
      remainingBeforeFinal,
      finalAmt,
    };
  }, [
    billLines,
    linePrices,
    lumpTotal,
    discountAmount,
    advanceAmount,
    partPaymentDrafts,
    finalPaymentAmount,
  ]);

  const previewPieces = useMemo(() => {
    return orderPieces.map((piece, index) => {
      const isFirst = index === 0;
      const line = billLines.find((item) =>
        item.pieces.some((row) => row.id === piece.id),
      );
      const unit = line ? (orderMoney.units[line.key] ?? 0) : 0;
      return {
        ...piece,
        totalAmount: orderMoney.anyEach ? unit : isFirst ? orderMoney.total : 0,
        discountAmount: isFirst ? orderMoney.discount : 0,
        advanceAmount: isFirst ? orderMoney.advance : 0,
        advanceDate:
          isFirst && orderMoney.advance > 0 ? advanceDate || todayDateString() : null,
        partPayments: isFirst ? orderMoney.parts : [],
        finalPaymentAmount: isFirst ? orderMoney.finalAmt : 0,
        finalPaymentDate:
          isFirst && orderMoney.finalAmt > 0
            ? finalPaymentDate || todayDateString()
            : null,
      };
    });
  }, [orderPieces, billLines, orderMoney, advanceDate, finalPaymentDate]);

  const previewCloth = {
    ...cloth,
    garmentType: sizing.garmentType,
    gender: sizing.gender,
    measurements: sizing.measurements,
    size:
      formatMeasurementsSummary(sizing.garmentType, sizing.measurements) ||
      cloth.size,
  };

  async function handleSave() {
    setError(null);
    const garmentType = getGarmentType(sizing.garmentType);
    if (!garmentType) {
      setError("Please select a cloth type");
      return;
    }
    const total = orderMoney.total;
    const discount = orderMoney.discount;
    if (discount > total) {
      setError("Discount cannot exceed total amount");
      return;
    }
    if (orderMoney.advance + orderMoney.partTotal > orderMoney.net + 0.009) {
      setError("Advance and part payments cannot exceed the net bill");
      return;
    }
    if (orderMoney.finalAmt > 0 && orderMoney.remainingBeforeFinal <= 0) {
      setError(
        "The bill is already settled. Clear final payment, or use part payment only while money is still due.",
      );
      return;
    }
    if (
      orderMoney.finalAmt > 0 &&
      Math.abs(orderMoney.finalAmt - orderMoney.remainingBeforeFinal) > 0.009
    ) {
      setError(
        `Final payment must complete the bill. Remaining is ${formatCurrency(orderMoney.remainingBeforeFinal)}. Use part payment for a smaller amount.`,
      );
      return;
    }
    const phoneResult = normalizeCustomerPhone(customerPhone);
    if (!phoneResult.ok) {
      setError(phoneResult.error);
      return;
    }

    setBusy(true);
    try {
      const sizeSummary = formatMeasurementsSummary(
        sizing.garmentType,
        sizing.measurements,
      );
      const garmentLabel = garmentDisplayLabel(
        sizing.garmentType,
        garmentType.label,
      );
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
      const list =
        orderCloths && orderCloths.length > 0 ? orderCloths : [cloth];
      await updateClothCustomerPhone(
        [...new Set(list.map((item) => item.id))],
        phoneResult.phone,
      );
      for (const line of billLines) {
        const nextQty = qtyDrafts[line.key] ?? line.qty;
        const unit = orderMoney.units[line.key] ?? 0;
        const isActive = line.pieces.some((item) => item.id === cloth.id);
        await adjustClothQuantity(
          {
            ...(isActive ? cloth : line.pieces[0]!),
            customerPhone: phoneResult.phone,
            garment: isActive ? garmentLabel : line.pieces[0]!.garment,
            garmentType: isActive
              ? sizing.garmentType
              : line.pieces[0]!.garmentType,
            gender: isActive ? sizing.gender : line.pieces[0]!.gender,
            size: isActive ? sizeSummary : line.pieces[0]!.size,
            measurements: isActive
              ? sizing.measurements
              : line.pieces[0]!.measurements,
            inGroup: isActive ? sizing.inGroup : line.pieces[0]!.inGroup,
            notes: isActive ? nextNotes : line.pieces[0]!.notes,
            totalAmount: unit,
            discountAmount: 0,
            advanceAmount: 0,
          },
          line.pieces,
          nextQty,
        );
      }
      await updateClothDates(cloth.id, {
        givenDate: givenDate.trim() || null,
        deliveryDate: deliveryDate.trim() || null,
        cutterExpectedDate: cutterExpectedDate.trim() || null,
        tailorExpectedDate: tailorExpectedDate.trim() || null,
      });
      await Promise.all(
        previewPieces.map((piece) =>
          updateClothPayments(piece.id, {
            totalAmount: piece.totalAmount,
            discountAmount: piece.discountAmount,
            advanceAmount: piece.advanceAmount,
            advanceDate: piece.advanceDate,
            partPayments: piece.partPayments.filter((item) => item.amount > 0),
            finalPaymentAmount: piece.finalPaymentAmount,
            finalPaymentDate: piece.finalPaymentDate,
          }),
        ),
      );
      await assignCutter(cloth.id, cutterId || null);
      await assignTailor(
        cloth.id,
        tailorId || null,
        tailorExpectedDate.trim() || null,
        {
          startSewing:
            (cloth.status === "ready_to_sew" || cloth.status === "sewing") &&
            Boolean(tailorId),
        },
      );
      let jobs = jobsFromLegacyColumns(cloth);
      jobs = upsertStaffJob(jobs, {
        type: "cutter",
        staffId: cutterId || null,
        amount: cutterId
          ? cutterPay.amount ||
            staffRateForGarment(sizing.garmentType, "cutter")
          : 0,
        advance: cutterId ? cutterPay.advance : 0,
        final: cutterId ? cutterPay.final : 0,
        remarks: cutterId ? cutterPay.remarks : "",
      });
      jobs = upsertStaffJob(jobs, {
        type: "tailor",
        staffId: tailorId || null,
        amount: tailorId
          ? tailorPay.amount ||
            staffRateForGarment(sizing.garmentType, "tailor")
          : 0,
        advance: tailorId ? tailorPay.advance : 0,
        final: tailorId ? tailorPay.final : 0,
        remarks: tailorId ? tailorPay.remarks : "",
      });
      for (const role of extraStaffTypes) {
        const staffId = extraAssign[role.slug] || null;
        const pay = extraPay[role.slug];
        jobs = upsertStaffJob(jobs, {
          type: role.slug,
          staffId,
          amount:
            pay?.amount ?? staffRateForGarment(cloth.garmentType, role.slug),
          advance: pay?.advance ?? 0,
          final: pay?.final ?? 0,
          remarks: pay?.remarks ?? "",
        });
      }
      await writeStaffJobs(cloth.id, jobs);
      onUpdated();
      showToast(pieceCount > 1 ? `Saved ${cloth.code}` : "Saved");
      if (pieceCount <= 1) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const pieceCount =
    orderCloths && orderCloths.length > 0 ? orderCloths.length : 1;
  const isMulti = pieceCount > 1;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="ticket relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[18px] sm:max-h-[min(92dvh,900px)] sm:w-[min(72rem,calc(100vw-3rem))] sm:rounded-[18px]"
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== "NumpadEnter") return;
          if (event.target instanceof HTMLTextAreaElement) return;
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold tracking-wide text-ink">
                {(
                  orderCloths?.find((item) => item.orderCode)?.orderCode ||
                  cloth.orderCode ||
                  "Order"
                ).trim()}
                <span className="ml-2 font-sans text-sm font-medium text-ink-muted">
                  {cloth.code}
                </span>
              </p>
              <p className="truncate font-semibold text-ink">
                {cloth.customerName}
              </p>
              <p className="truncate text-sm text-ink-muted">
                {isMulti
                  ? `${pieceCount} clothes · editing ${cloth.code}`
                  : `${clothBillName(previewCloth)}${groupQty > 1 ? ` · Qty ${groupQty}` : ""}`}
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
              <span className="ms-2 font-sans font-medium text-ink-muted">
                {clothBillName(previewCloth)}
              </span>
            </p>
          )}

          {(cutter ||
            tailor ||
            extraStaffTypes.some((role) => extraAssign[role.slug])) && (
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
              {cutter && (
                <p>
                  Cutter: <strong className="text-ink">{cutter.name}</strong>
                </p>
              )}
              {tailor && (
                <p>
                  Tailor: <strong className="text-ink">{tailor.name}</strong>
                </p>
              )}
              {extraJobs.map((job) => {
                const member = getStaffById(
                  staff,
                  extraAssign[job.type] || job.staffId,
                );
                if (!member) return null;
                return (
                  <p key={job.type}>
                    {staffTypeLabel(job.type)}:{" "}
                    <strong className="text-ink">{member.name}</strong>
                  </p>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mb-4 rounded-[10px] bg-overdue/10 px-3 py-2 text-sm text-overdue">
              {error}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-3">
              <div className="rounded-[14px] border border-seam bg-paper/70 p-4">
                <p className="mb-3 text-sm font-semibold text-ink">
                  {isMulti
                    ? `Measurements · ${cloth.code}`
                    : "Cloth & Measurements"}
                </p>
                <GarmentSizingForm
                  layout="wide"
                  value={sizing}
                  rememberedSizing={(garmentType) =>
                    latestSizingForCustomer(
                      allCloths,
                      cloth.customerName,
                      customerPhone,
                      garmentType,
                    )
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
                      onChange={(e) => {
                        const raw = e.target.value;
                        setQuantity(raw);
                        const parsed = Math.floor(Number(raw));
                        if (!Number.isFinite(parsed) || parsed < 1) return;
                        if (!activeLineKey) return;
                        applyLineQty(activeLineKey, parsed);
                      }}
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
                {(givenDate ||
                  deliveryDate ||
                  cutterExpectedDate ||
                  tailorExpectedDate) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {givenDate && <>Order: {formatCalendarDate(givenDate)}</>}
                    {deliveryDate && (
                      <>
                        {givenDate && " · "}
                        Delivery: {formatCalendarDate(deliveryDate)}
                      </>
                    )}
                    {cutterExpectedDate && (
                      <>
                        {(givenDate || deliveryDate) && " · "}
                        <span
                          className={
                            cutterOverdue ? "font-semibold text-rose-600" : ""
                          }
                        >
                          Cutter by: {formatCalendarDate(cutterExpectedDate)}
                          {cutterOverdue ? " (overdue)" : ""}
                        </span>
                      </>
                    )}
                    {tailorExpectedDate && (
                      <>
                        {(givenDate || deliveryDate || cutterExpectedDate) &&
                          " · "}
                        <span
                          className={
                            tailorOverdue ? "font-semibold text-rose-600" : ""
                          }
                        >
                          Tailor by: {formatCalendarDate(tailorExpectedDate)}
                          {tailorOverdue ? " (overdue)" : ""}
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
                  Customer payment
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Clothes
                    </p>
                    {billLines.map((line) => {
                      const unit = orderMoney.units[line.key] ?? 0;
                      const lineTotal = orderMoney.lineAmounts[line.key] ?? 0;
                      return (
                        <div
                          key={line.key}
                          className="flex flex-wrap items-end gap-2 rounded-[10px] border border-seam bg-white px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="truncate text-sm font-semibold text-ink">
                              {line.title}
                            </p>
                            <p className="text-[11px] text-ink-muted">
                              Qty {line.qty}
                              {unit > 0 && line.qty > 1
                                ? ` × ${formatCurrency(unit)} = ${formatCurrency(lineTotal)}`
                                : ""}
                              {line.pieces[0]?.code
                                ? ` · ${line.pieces[0].code}`
                                : ""}
                            </p>
                          </div>
                          <div className="w-full sm:w-[8.5rem]">
                            <Input
                              label="Each (₹)"
                              type="number"
                              min="0"
                              step="0.01"
                              value={linePrices[line.key] ?? ""}
                              onChange={(event) =>
                                setLinePrices((current) => ({
                                  ...current,
                                  [line.key]: event.target.value,
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-ink-muted">
                      Type this cloth’s price yourself. Qty does not change it. Leave Each empty to
                      keep the order total from registration.
                    </p>
                  </div>
                  {orderMoney.anyEach ? (
                    <div className="flex items-baseline justify-between gap-3 rounded-[10px] border border-seam bg-white px-3 py-2.5">
                      <p className="text-sm font-semibold text-ink">Order total</p>
                      <p className="font-display text-xl font-bold tabular text-ink">
                        {formatCurrency(orderMoney.total)}
                      </p>
                    </div>
                  ) : (
                    <Input
                      label="Order total (₹)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={lumpTotal}
                      onChange={(e) => setLumpTotal(e.target.value)}
                      placeholder="2500"
                    />
                  )}
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
                    <p className="text-sm font-medium text-slate-700">
                      Part Payment
                    </p>
                    {partPaymentDrafts.map((row, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
                          <Input
                            label={index === 0 ? "Amount (₹)" : "\u00a0"}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => {
                              const next = [...partPaymentDrafts];
                              next[index] = {
                                ...row,
                                amount: event.target.value,
                              };
                              setPartPaymentDrafts(next);
                            }}
                            placeholder="e.g. 500"
                          />
                          <Input
                            label={index === 0 ? "Date" : "\u00a0"}
                            type="date"
                            value={row.date}
                            onChange={(event) => {
                              const next = [...partPaymentDrafts];
                              next[index] = {
                                ...row,
                                date: event.target.value,
                              };
                              setPartPaymentDrafts(next);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = partPaymentDrafts.filter(
                              (_, itemIndex) => itemIndex !== index,
                            );
                            setPartPaymentDrafts(
                              next.length > 0
                                ? next
                                : [emptyPartPaymentDraft(todayDateString())],
                            );
                          }}
                          disabled={
                            partPaymentDrafts.length === 1 && !row.amount
                          }
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
                      placeholder={
                        orderMoney.remainingBeforeFinal > 0
                          ? formatCurrency(orderMoney.remainingBeforeFinal)
                          : orderMoney.net > 0
                            ? "Bill already settled"
                            : "Remaining"
                      }
                      disabled={
                        orderMoney.remainingBeforeFinal <= 0 &&
                        parseAmount(finalPaymentAmount) <= 0
                      }
                    />
                    <Input
                      label="Final date"
                      type="date"
                      value={finalPaymentDate}
                      onChange={(e) => setFinalPaymentDate(e.target.value)}
                      disabled={
                        orderMoney.remainingBeforeFinal <= 0 &&
                        parseAmount(finalPaymentAmount) <= 0
                      }
                    />
                  </div>
                  {orderMoney.remainingBeforeFinal > 0 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-ink-muted">
                        Remaining{" "}
                        {formatCurrency(orderMoney.remainingBeforeFinal)}. Final
                        payment can only close the full remaining balance — use
                        part payment for anything smaller.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 rounded-lg px-3 py-2 text-sm"
                        onClick={() => {
                          setFinalPaymentAmount(
                            String(orderMoney.remainingBeforeFinal),
                          );
                          setFinalPaymentDate(todayDateString());
                        }}
                      >
                        Collect remaining as final
                      </Button>
                    </div>
                  ) : orderMoney.net > 0 ? (
                    <p className="text-xs font-medium text-done">
                      All payment is complete. Final payment is only used to
                      close a remaining balance.
                    </p>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Enter each cloth’s price to get the order total, then
                      collect advance, parts, or final.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-action/20 bg-action/5 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">
                  Staff
                </p>
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
                            ? current.amount ||
                              staffRateForGarment(sizing.garmentType, "cutter")
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
                            ? current.amount ||
                              staffRateForGarment(sizing.garmentType, "tailor")
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
                    const members = staff.filter(
                      (member) => member.type === role.slug,
                    );
                    if (members.length === 0) return null;
                    const staffId = extraAssign[role.slug] ?? "";
                    const member = getStaffById(staff, staffId);
                    const pay = extraPay[role.slug] ?? {
                      amount: staffRateForGarment(cloth.garmentType, role.slug),
                      advance: 0,
                      final: 0,
                      remarks: "",
                    };
                    return (
                      <div key={role.slug}>
                        <Select
                          label={role.label}
                          value={staffId}
                          searchable={false}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setExtraAssign((current) => ({
                              ...current,
                              [role.slug]: nextId,
                            }));
                            setExtraPay((current) => ({
                              ...current,
                              [role.slug]: {
                                amount: nextId
                                  ? current[role.slug]?.amount ||
                                    staffRateForGarment(
                                      cloth.garmentType,
                                      role.slug,
                                    )
                                  : 0,
                                advance: current[role.slug]?.advance ?? 0,
                                final: current[role.slug]?.final ?? 0,
                                remarks: current[role.slug]?.remarks ?? "",
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
                                setExtraPay((current) => ({
                                  ...current,
                                  [role.slug]: next,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <PaymentSummary cloths={previewPieces} />

              <p className="text-center text-xs text-ink-muted">
                Scan barcode to mark cutting / sewing complete or assign tailor.
              </p>

              <Button
                variant="secondary"
                className="w-full py-3"
                onClick={onShowBarcode}
              >
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
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

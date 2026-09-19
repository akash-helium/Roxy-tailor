import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, Plus, Printer, Receipt, Search, Settings2, Trash2, UserCog } from 'lucide-react';
import { assignCutter, assignStaffJob, assignTailor, deleteCloths, getStaffById, registerClothOrder, setClothDone } from '../lib/data';
import { useClothList } from '../hooks/useClothList';
import {
  CLOTH_FILTER_OPTIONS,
  type ClothStatusFilter,
} from '../lib/cloth-list';
import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
  type Cloth,
  type Staff,
} from '../types';
import { formatDate, formatCalendarDate, isPastDue, todayDateString, clothDescription, clothBillName } from '../lib/utils';
import { formatCurrency, parseAmount, summarizePayments } from '../lib/payments';
import { BarcodePrintSheet } from '../components/BarcodePrintSheet';
import { CustomerBillPrintSheet } from '../components/CustomerBillPrintSheet';
import { RegisterPrintPrompt } from '../components/RegisterPrintPrompt';
import { getCustomerOrderCloths, getOrderRepresentatives, groupClothsForStaffTickets, orderWorkflowStatus } from '../lib/customer-order';
import { ClothManageSheet } from '../components/ClothManageSheet';
import { GarmentSizingForm, emptyGarmentSizing } from '../components/GarmentSizingForm';
import type { MeasurementData } from '../lib/measurements';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { garmentDisplayLabel, getGarmentType } from '../lib/garments';
import { formatMeasurementsSummary } from '../lib/measurements';
import { findCustomerByPhone, findKnownCustomer, latestSizingForCustomer, listKnownCustomers, suggestCustomersByPhone } from '../lib/customer-history';
import { emptyStaffJob, staffRateForGarment } from '../lib/staff-jobs';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import {
  normalizeCustomerPhone,
  openWhatsAppPlaceholder,
  sendOrderConfirmationWhatsApp,
} from '../lib/whatsapp';

type ClothLineItem = {
  id: string;
  quantity: string;
  sizing: MeasurementData;
  cutterId: string;
  tailorId: string;
  cutterExpectedDate: string;
  tailorExpectedDate: string;
  cutterPayAmount: string;
  tailorPayAmount: string;
  extraStaff: Record<string, { staffId: string; payAmount: string }>;
};

function newClothLineItem(
  defaults?: Partial<
    Pick<
      ClothLineItem,
      | 'quantity'
      | 'cutterId'
      | 'tailorId'
      | 'cutterExpectedDate'
      | 'tailorExpectedDate'
      | 'cutterPayAmount'
      | 'tailorPayAmount'
      | 'extraStaff'
    >
  >,
): ClothLineItem {
  return {
    id: crypto.randomUUID(),
    quantity: defaults?.quantity ?? '1',
    sizing: { ...emptyGarmentSizing },
    cutterId: defaults?.cutterId ?? '',
    tailorId: defaults?.tailorId ?? '',
    cutterExpectedDate: defaults?.cutterExpectedDate ?? '',
    tailorExpectedDate: defaults?.tailorExpectedDate ?? '',
    cutterPayAmount: defaults?.cutterPayAmount ?? '',
    tailorPayAmount: defaults?.tailorPayAmount ?? '',
    extraStaff: defaults?.extraStaff ?? {},
  };
}

function parseLineQuantity(value: string) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 1;
}

function totalPiecesFromItems(items: ClothLineItem[]) {
  return items.reduce((sum, item) => sum + parseLineQuantity(item.quantity), 0);
}

function splitAmount(amount: number, parts: number) {
  if (parts <= 0) return amount;
  return Math.round((amount / parts) * 100) / 100;
}

const emptyForm = {
  customerName: '',
  customerPhone: '',
  notes: '',
  totalAmount: '',
  discountAmount: '',
  advanceAmount: '',
  givenDate: todayDateString(),
  deliveryDate: '',
  items: [newClothLineItem()],
};

function countForFilter(filter: ClothStatusFilter, counts: ReturnType<typeof useClothList>['statusCounts']) {
  if (filter === 'all') return counts.total;
  if (filter === 'cutting') return counts.cutting;
  if (filter === 'ready_to_sew') return counts.ready;
  if (filter === 'sewing') return counts.sewing;
  return counts.completed;
}

function ClothListItem({
  cloth,
  staff,
  allCloths,
  onReprint,
  onPrintBill,
  onManage,
  onAssigned,
  onDeleted,
}: {
  cloth: Cloth;
  staff: Staff[];
  allCloths: Cloth[];
  onReprint: (cloths: Cloth[]) => void;
  onPrintBill: (cloths: Cloth[]) => void;
  onManage: (cloth: Cloth) => void;
  onAssigned: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}) {
  const orderCloths = getCustomerOrderCloths(cloth, allCloths);
  const orderPieceCount = orderCloths.length;
  const staffTicketCount = groupClothsForStaffTickets(orderCloths).length;
  const orderPayments = summarizePayments(orderCloths);
  const status = orderWorkflowStatus(orderCloths);
  const cutter = getStaffById(staff, cloth.cutterId);
  const tailor = getStaffById(staff, cloth.tailorId);
  const cutterOverdue =
    cloth.status === 'cutting' && isPastDue(cloth.cutterExpectedDate, false);
  const tailorOverdue =
    cloth.status === 'sewing' && isPastDue(cloth.tailorExpectedDate, false);

  const { types: staffRoleTypes, getLabel: staffTypeLabel } = useStaffTypes();
  const extraStaffTypes = staffRoleTypes.filter((item) => item.slug !== 'cutter' && item.slug !== 'tailor');
  const cutters = staff.filter((m) => m.type === 'cutter');
  const tailors = staff.filter((m) => m.type === 'tailor');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [doneBusy, setDoneBusy] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDone = cloth.status === 'completed';

  async function handleAssignCutter(piece: Cloth, value: string) {
    setAssigning(true);
    setAssignError(null);
    try {
      await assignCutter(piece.id, value || null);
      await onAssigned();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign cutter');
    } finally {
      setAssigning(false);
    }
  }

  async function handleAssignTailor(piece: Cloth, value: string) {
    setAssigning(true);
    setAssignError(null);
    try {
      const startSewing = piece.status === 'ready_to_sew' || piece.status === 'sewing';
      await assignTailor(piece.id, value || null, piece.tailorExpectedDate ?? null, {
        startSewing: startSewing && Boolean(value),
      });
      await onAssigned();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign tailor');
    } finally {
      setAssigning(false);
    }
  }

  async function handleAssignExtra(piece: Cloth, type: string, value: string) {
    setAssigning(true);
    setAssignError(null);
    try {
      await assignStaffJob(piece, type, value || null);
      await onAssigned();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign staff');
    } finally {
      setAssigning(false);
    }
  }

  async function handleDeleteOrder() {
    const pieceLabel = orderPieceCount === 1 ? '1 piece' : `${orderPieceCount} pieces`;
    const confirmed = window.confirm(
      `Delete order for ${cloth.customerName || 'this customer'} (${pieceLabel})?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteCloths(orderCloths.map((c) => c.id));
      await onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete order');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleToggleDone() {
    setDoneBusy(true);
    setDoneError(null);
    try {
      await setClothDone(cloth.id, !isDone);
      await onAssigned();
    } catch (err) {
      setDoneError(err instanceof Error ? err.message : 'Failed to update done status');
    } finally {
      setDoneBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{cloth.customerName || 'Unknown'}</p>
          {cloth.customerPhone ? (
            <p className="truncate text-xs text-slate-400">{cloth.customerPhone}</p>
          ) : null}
          {orderPieceCount > 1 ? (
            <div className="mt-1 space-y-1">
              {orderCloths.map((piece) => {
                const pieceStatus = piece.status in CLOTH_STATUS_LABELS ? piece.status : 'cutting';
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => onManage(piece)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-0 py-0.5 text-left"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-500">
                      {clothBillName(piece)}
                      <span className="ml-1.5 font-mono text-[11px] text-indigo-600">{piece.code}</span>
                    </span>
                    <Badge className={`shrink-0 ${CLOTH_STATUS_COLORS[pieceStatus]}`}>
                      {CLOTH_STATUS_LABELS[pieceStatus]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="truncate text-sm text-slate-500">{clothDescription(cloth)}</p>
          )}
        </div>
        <Badge className={`shrink-0 ${CLOTH_STATUS_COLORS[status]}`}>
          {CLOTH_STATUS_LABELS[status]}
        </Badge>
      </div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="font-mono font-semibold text-indigo-600">
          {cloth.code}
          {orderPieceCount > 1 && (
            <span className="ml-1 font-sans font-medium text-slate-500">
              · {orderPieceCount} pieces
            </span>
          )}
        </span>
        {orderPieceCount === 1 && cutter && <span>Cutter: {cutter.name}</span>}
        {orderPieceCount === 1 && tailor && <span>Tailor: {tailor.name}</span>}
        {cloth.givenDate && <span>Order: {formatCalendarDate(cloth.givenDate)}</span>}
        {cloth.deliveryDate && <span>Delivery: {formatCalendarDate(cloth.deliveryDate)}</span>}
        {cloth.cutterExpectedDate && (
          <span className={cutterOverdue ? 'font-semibold text-rose-600' : ''}>
            Cutter by: {formatCalendarDate(cloth.cutterExpectedDate)}
            {cutterOverdue ? ' (overdue)' : ''}
          </span>
        )}
        {cloth.tailorExpectedDate && (
          <span className={tailorOverdue ? 'font-semibold text-rose-600' : ''}>
            Tailor by: {formatCalendarDate(cloth.tailorExpectedDate)}
            {tailorOverdue ? ' (overdue)' : ''}
          </span>
        )}
        {cloth.updatedAt && !cloth.givenDate && <span>{formatDate(cloth.updatedAt)}</span>}
        {orderPayments.totalBill > 0 && (
          <span className="font-semibold text-amber-700">
            Pending: {formatCurrency(orderPayments.totalPending)}
            {orderPayments.totalDiscount > 0 && (
              <span className="font-normal text-slate-500">
                {' '}
                (disc. {formatCurrency(orderPayments.totalDiscount)})
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => setAssignOpen((v) => !v)}
          className="rounded-full px-3 py-1.5 text-xs"
        >
          <UserCog className="h-3.5 w-3.5" />
          Assign
        </Button>
        <Button
          variant="secondary"
          onClick={() => onManage(cloth)}
          className="rounded-full px-3 py-1.5 text-xs"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage
        </Button>
        <Button
          variant="secondary"
          onClick={() => onPrintBill(orderCloths)}
          className="rounded-full px-3 py-1.5 text-xs"
        >
          <Receipt className="h-3.5 w-3.5" />
          {orderPieceCount > 1 ? `Print Bill (${orderPieceCount})` : 'Print Bill'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => onReprint(orderCloths)}
          className="rounded-full px-3 py-1.5 text-xs"
        >
          <Printer className="h-3.5 w-3.5" />
          {staffTicketCount > 1 ? `Staff Tickets (${staffTicketCount})` : 'Staff Barcode'}
        </Button>
        {orderPieceCount === 1 && (
        <Button
          variant={isDone ? 'primary' : 'secondary'}
          onClick={() => void handleToggleDone()}
          disabled={doneBusy}
          className={`rounded-full px-3 py-1.5 text-xs ${isDone ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
        >
          {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {doneBusy ? 'Saving...' : isDone ? 'Done' : 'Mark Done'}
        </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => void handleDeleteOrder()}
          disabled={deleteBusy}
          className="rounded-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleteBusy ? 'Deleting...' : orderPieceCount > 1 ? 'Delete Order' : 'Delete'}
        </Button>
      </div>

      {deleteError && (
        <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{deleteError}</p>
      )}

      {doneError && (
        <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{doneError}</p>
      )}

      {assignOpen && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {assignError && (
            <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{assignError}</p>
          )}
          {orderCloths.map((piece) => (
            <div
              key={piece.id}
              className="space-y-2 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0"
            >
              {orderPieceCount > 1 && (
                <p className="text-xs font-semibold text-slate-700">
                  {clothBillName(piece)}
                  <span className="ml-1.5 font-mono font-medium text-indigo-600">{piece.code}</span>
                </p>
              )}
              <Select
                label="Cutter"
                value={piece.cutterId ?? ''}
                disabled={assigning || cutters.length === 0}
                onChange={(e) => void handleAssignCutter(piece, e.target.value)}
              >
                <option value="">No cutter</option>
                {cutters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Tailor"
                value={piece.tailorId ?? ''}
                disabled={assigning || tailors.length === 0}
                onChange={(e) => void handleAssignTailor(piece, e.target.value)}
              >
                <option value="">No tailor</option>
                {tailors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {extraStaffTypes.map((role) => {
                const members = staff.filter((member) => member.type === role.slug);
                if (members.length === 0) return null;
                const current =
                  (piece.staffJobs ?? []).find((job) => job.type === role.slug)?.staffId ?? '';
                return (
                  <Select
                    key={role.slug}
                    label={role.label}
                    value={current}
                    disabled={assigning}
                    onChange={(e) => void handleAssignExtra(piece, role.slug, e.target.value)}
                  >
                    <option value="">No {staffTypeLabel(role.slug).toLowerCase()}</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                );
              })}
            </div>
          ))}
          <p className="text-[10px] text-slate-500">
            Each cloth has its own cutter and tailor. Scan that cloth&apos;s staff ticket to mark it complete.
          </p>
        </div>
      )}
    </Card>
  );
}

export function OrdersPage() {
  const {
    cloths,
    allCloths,
    staff,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    statusCounts,
    total,
    hasMore,
    listLoading,
    loadMore,
    refreshList,
  } = useClothList();

  const [open, setOpen] = useState(false);
  const [printOrderCloths, setPrintOrderCloths] = useState<Cloth[] | null>(null);
  const [billCloths, setBillCloths] = useState<Cloth[] | null>(null);
  const [savedCloths, setSavedCloths] = useState<Cloth[] | null>(null);
  const [manageCloth, setManageCloth] = useState<Cloth | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [phoneSuggestOpen, setPhoneSuggestOpen] = useState(false);

  const { types: staffRoleTypes, getLabel: staffTypeLabel } = useStaffTypes();
  const extraStaffTypes = staffRoleTypes.filter((item) => item.slug !== 'cutter' && item.slug !== 'tailor');
  const cutters = staff.filter((member) => member.type === 'cutter');
  const tailors = staff.filter((member) => member.type === 'tailor');
  const hasStaff = staff.length > 0;
  const knownCustomers = useMemo(() => listKnownCustomers(allCloths), [allCloths]);
  const phoneSuggestions = useMemo(
    () => suggestCustomersByPhone(allCloths, form.customerPhone),
    [allCloths, form.customerPhone],
  );
  const matchedCustomer =
    findCustomerByPhone(allCloths, form.customerPhone) ??
    findKnownCustomer(allCloths, form.customerName);

  function applyCustomerDetails(name: string, phone = form.customerPhone) {
    const known = findKnownCustomer(allCloths, name);
    const nextPhone = phone.trim() || known?.phone || '';
    setForm((current) => ({
      ...current,
      customerName: name,
      customerPhone: nextPhone,
      items: current.items.map((item) => {
        if (!item.sizing.garmentType) return item;
        const remembered = latestSizingForCustomer(
          allCloths,
          name,
          nextPhone,
          item.sizing.garmentType,
        );
        if (!remembered) return item;
        return {
          ...item,
          sizing: {
            ...item.sizing,
            gender: remembered.gender,
            measurements: { ...item.sizing.measurements, ...remembered.measurements },
          },
        };
      }),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);

    const orderTotal = parseAmount(form.totalAmount);
    const orderDiscount = parseAmount(form.discountAmount);
    if (orderDiscount > orderTotal) {
      setActionError('Discount cannot exceed total amount');
      setSaving(false);
      return;
    }

    if (form.items.length === 0) {
      setActionError('Add at least one cloth');
      setSaving(false);
      return;
    }

    for (let i = 0; i < form.items.length; i += 1) {
      const item = form.items[i];
      const garmentType = getGarmentType(item.sizing.garmentType);
      if (!garmentType) {
        setActionError(`Cloth ${i + 1}: select cloth type and enter measurements`);
        setSaving(false);
        return;
      }
    }

    const pieceCount = totalPiecesFromItems(form.items);
    const perTotal = splitAmount(orderTotal, pieceCount);
    const perDiscount = splitAmount(orderDiscount, pieceCount);
    const perAdvance = splitAmount(parseAmount(form.advanceAmount), pieceCount);
    const phoneResult = normalizeCustomerPhone(form.customerPhone);
    if (!phoneResult.ok) {
      setActionError(phoneResult.error);
      setSaving(false);
      return;
    }

    const whatsappPopup = phoneResult.phone ? openWhatsAppPlaceholder() : null;

    const orderBatchId = crypto.randomUUID();
    try {
      const payloads = [];
      for (const item of form.items) {
        const garmentType = getGarmentType(item.sizing.garmentType)!;
        const sizeSummary = formatMeasurementsSummary(item.sizing.garmentType, item.sizing.measurements);
        const qty = parseLineQuantity(item.quantity);

        for (let i = 0; i < qty; i += 1) {
          payloads.push({
            customerName: form.customerName,
            customerPhone: phoneResult.phone,
            garment: garmentDisplayLabel(item.sizing.garmentType, garmentType.label),
            garmentType: item.sizing.garmentType,
            gender: item.sizing.gender,
            fabricColor: '',
            size: sizeSummary,
            measurements: item.sizing.measurements,
            inGroup: item.sizing.inGroup,
            notes: form.notes,
            cutterId: item.cutterId.trim() || null,
            tailorId: item.tailorId.trim() || null,
            cutterPayAmount: item.cutterId.trim()
              ? parseAmount(item.cutterPayAmount) || staffRateForGarment(item.sizing.garmentType, 'cutter')
              : 0,
            tailorPayAmount: item.tailorId.trim()
              ? parseAmount(item.tailorPayAmount) || staffRateForGarment(item.sizing.garmentType, 'tailor')
              : 0,
            staffJobs: [
              item.cutterId.trim()
                ? emptyStaffJob(
                    'cutter',
                    item.cutterId,
                    parseAmount(item.cutterPayAmount) || staffRateForGarment(item.sizing.garmentType, 'cutter'),
                  )
                : null,
              item.tailorId.trim()
                ? emptyStaffJob(
                    'tailor',
                    item.tailorId,
                    parseAmount(item.tailorPayAmount) || staffRateForGarment(item.sizing.garmentType, 'tailor'),
                  )
                : null,
              ...Object.entries(item.extraStaff ?? {}).map(([type, slot]) =>
                slot.staffId
                  ? emptyStaffJob(
                      type,
                      slot.staffId,
                      parseAmount(slot.payAmount) || staffRateForGarment(item.sizing.garmentType, type),
                    )
                  : null,
              ),
            ].filter((job): job is NonNullable<typeof job> => Boolean(job)),
            totalAmount: perTotal,
            discountAmount: perDiscount,
            advanceAmount: perAdvance,
            givenDate: form.givenDate || todayDateString(),
            deliveryDate: form.deliveryDate.trim() || null,
            cutterExpectedDate: item.cutterExpectedDate.trim() || null,
            tailorExpectedDate: item.tailorExpectedDate.trim() || null,
            orderBatchId,
          });
        }
      }

      const created = (await registerClothOrder(payloads)).map((cloth) => ({
        ...cloth,
        customerPhone: cloth.customerPhone || phoneResult.phone,
      }));
      if (phoneResult.phone) {
        sendOrderConfirmationWhatsApp(created, phoneResult.phone, whatsappPopup);
      } else {
        whatsappPopup?.close();
      }
      setForm({ ...emptyForm, givenDate: todayDateString(), deliveryDate: '', items: [newClothLineItem()] });
      setOpen(false);
      setSavedCloths(created);
      await refreshList();
    } catch (err) {
      whatsappPopup?.close();
      setActionError(err instanceof Error ? err.message : 'Failed to register cloth');
    } finally {
      setSaving(false);
    }
  }

  const registerPieceCount = totalPiecesFromItems(form.items);

  async function handleUpdated() {
    await refreshList();
  }

  const manageClothLive = manageCloth
    ? cloths.find((c) => c.id === manageCloth.id) ?? manageCloth
    : null;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-5">
        <p className="text-sm text-slate-500">Loading cloths...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col p-4 pb-6 sm:p-5">
      <PageHeader
        title="Cloths"
        subtitle="Search, filter, and manage orders"
        action={
          <Button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full px-4"
          >
            <Plus className="h-4 w-4" />
            Register
          </Button>
        }
      />

      {(error || actionError) && (
        <Card className="mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error ?? actionError}
        </Card>
      )}

      {!hasStaff && (
        <Card className="mb-4 border-sky-200 bg-sky-50 text-sm text-sky-800">
          No staff added yet — you can still register cloth and apply a customer discount. Assign cutter/tailor later from Staff or Scanner.
        </Card>
      )}

      {hasStaff && cutters.length === 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
          Add a <strong>Cloth Cutter</strong> in Staff to assign cutting work, or register without a cutter for now.
        </Card>
      )}

      {hasStaff && tailors.length === 0 && (
        <Card className="mb-4 border-violet-200 bg-violet-50 text-sm text-violet-800">
          Add at least one <strong>Tailor</strong> in Staff to assign sewing work.
        </Card>
      )}

      <Card className="z-20 mb-4 space-y-3 p-3.5 shadow-md shadow-slate-200/50 sm:p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, customer, garment, size..."
            data-allow-typing
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CLOTH_FILTER_OPTIONS.map((option) => {
            const active = statusFilter === option.id;
            const count = countForFilter(option.id, statusCounts);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center transition active:scale-[0.98] ${
                  active
                    ? option.activeClass
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-[11px] font-semibold leading-tight">{option.label}</span>
                <span
                  className={`min-w-[1.35rem] rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    active ? option.countClass : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <p className="text-xs font-medium text-slate-500">
            Showing {cloths.length} of {total}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-indigo-600 active:opacity-70"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {cloths.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-slate-700">
            {statusCounts.total === 0 ? 'No cloths yet' : 'No cloths match this filter'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {statusCounts.total === 0
              ? 'Register a cloth to start the workflow'
              : 'Try another filter or clear your search'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {getOrderRepresentatives(cloths, allCloths).map((cloth) => (
            <ClothListItem
              key={getCustomerOrderCloths(cloth, allCloths)[0]?.id ?? cloth.id}
              cloth={cloth}
              staff={staff}
              allCloths={allCloths}
              onReprint={setPrintOrderCloths}
              onPrintBill={setBillCloths}
              onManage={setManageCloth}
              onAssigned={handleUpdated}
              onDeleted={handleUpdated}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <Button
          variant="secondary"
          disabled={listLoading}
          onClick={() => void loadMore()}
          className="mt-4 w-full rounded-full py-3"
        >
          {listLoading ? 'Loading...' : `Load more (${cloths.length} / ${total})`}
        </Button>
      )}

      <Modal open={open} title="Register Cloth" size="wide" onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Customer Name"
              value={form.customerName}
              onChange={(e) => {
                const name = e.target.value;
                const known = findKnownCustomer(allCloths, name);
                if (known) {
                  applyCustomerDetails(known.name, known.phone || form.customerPhone);
                  return;
                }
                setForm({ ...form, customerName: name });
              }}
              onBlur={(e) => {
                const known = findKnownCustomer(allCloths, e.target.value);
                if (known) applyCustomerDetails(known.name, known.phone || form.customerPhone);
              }}
              list="known-customers"
              placeholder="Customer name"
              autoComplete="off"
              required
            />
            <div className="relative">
              <Input
                label="Mobile number"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={form.customerPhone}
                onChange={(e) => {
                  const phone = e.target.value;
                  setPhoneSuggestOpen(true);
                  const known = findCustomerByPhone(allCloths, phone);
                  if (known) {
                    applyCustomerDetails(known.name, known.phone);
                    return;
                  }
                  setForm({ ...form, customerPhone: phone });
                }}
                onFocus={() => setPhoneSuggestOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setPhoneSuggestOpen(false), 180);
                }}
                placeholder="9876543210"
              />
              {phoneSuggestOpen && phoneSuggestions.length > 0 && (
                <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {phoneSuggestions.map((customer) => (
                    <li key={`${customer.phone}-${customer.name}`}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-indigo-50"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          applyCustomerDetails(customer.name, customer.phone);
                          setPhoneSuggestOpen(false);
                        }}
                      >
                        <span className="text-sm font-semibold text-slate-800">{customer.name}</span>
                        <span className="font-mono text-xs text-slate-500">{customer.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <datalist id="known-customers">
            {knownCustomers.map((customer) => (
              <option key={`${customer.name}-${customer.phone}`} value={customer.name}>
                {customer.phone ? `${customer.name} · ${customer.phone}` : customer.name}
              </option>
            ))}
          </datalist>
          <p className="-mt-2 text-xs text-slate-500">
            Type a mobile number to pick an existing customer. A new save always creates a new order —
            it does not change their previous order.
          </p>
          {matchedCustomer ? (
            <p className="-mt-2 text-xs font-medium text-indigo-600">
              Existing customer: {matchedCustomer.name}
              {matchedCustomer.phone ? ` · ${matchedCustomer.phone}` : ''}. Select a cloth type to fill
              last saved sizes, then save to create a new order.
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Clothes</p>
              <span className="text-xs font-medium text-indigo-600">
                {registerPieceCount} piece{registerPieceCount === 1 ? '' : 's'} total
              </span>
            </div>

            {form.items.map((item, index) => {
              const cutterName = getStaffById(staff, item.cutterId || null)?.name;
              const tailorName = getStaffById(staff, item.tailorId || null)?.name;
              return (
              <div
                key={item.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Cloth {index + 1}</p>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          items: form.items.filter((row) => row.id !== item.id),
                        })
                      }
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                  <GarmentSizingForm
                    layout="wide"
                    value={item.sizing}
                    rememberedSizing={(garmentType) =>
                      latestSizingForCustomer(
                        allCloths,
                        form.customerName,
                        form.customerPhone,
                        garmentType,
                      )
                    }
                    onChange={(sizing) =>
                      setForm({
                        ...form,
                        items: form.items.map((row) => {
                          if (row.id !== item.id) return row;
                          const typeChanged = row.sizing.garmentType !== sizing.garmentType;
                          if (!typeChanged) return { ...row, sizing };
                          return {
                            ...row,
                            sizing,
                            cutterPayAmount: row.cutterId
                              ? String(staffRateForGarment(sizing.garmentType, 'cutter') || '')
                              : '',
                            tailorPayAmount: row.tailorId
                              ? String(staffRateForGarment(sizing.garmentType, 'tailor') || '')
                              : '',
                            extraStaff: Object.fromEntries(
                              Object.entries(row.extraStaff ?? {}).map(([type, slot]) => [
                                type,
                                {
                                  ...slot,
                                  payAmount: slot.staffId
                                    ? String(staffRateForGarment(sizing.garmentType, type) || '')
                                    : '',
                                },
                              ]),
                            ),
                          };
                        }),
                      })
                    }
                    afterClothType={
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        max="50"
                        step="1"
                        value={item.quantity}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: form.items.map((row) =>
                              row.id === item.id
                                ? { ...row, quantity: e.target.value }
                                : row,
                            ),
                          })
                        }
                        placeholder="1"
                      />
                    }
                  />
                  <div className="space-y-3 rounded-2xl border border-white bg-white/80 p-3 sm:p-4">
                    <p className="text-sm font-semibold text-slate-800">Staff & payout</p>
                    {cutters.length === 0 && tailors.length === 0 ? (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        No staff added yet. Assign cutter/tailor later from Staff or Scanner.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {cutters.length > 0 ? (
                          <Select
                            label="Cutter"
                            value={item.cutterId}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                items: form.items.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        cutterId: e.target.value,
                                        cutterPayAmount: e.target.value
                                          ? String(staffRateForGarment(item.sizing.garmentType, 'cutter') || row.cutterPayAmount)
                                          : '',
                                      }
                                    : row,
                                ),
                              })
                            }
                          >
                            <option value="">Assign later</option>
                            {cutters.map((cutter) => (
                              <option key={cutter.id} value={cutter.id}>
                                {cutter.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:col-span-2">
                            No cutters on staff for this cloth.
                          </p>
                        )}
                        {item.cutterId ? (
                          <p className="self-end pb-3 text-xs font-medium text-slate-600">
                            {cutterName ? `${cutterName}: ` : 'Cutter: '}
                            {formatCurrency(parseAmount(item.cutterPayAmount) || staffRateForGarment(item.sizing.garmentType, 'cutter'))}{' '}
                            × {parseLineQuantity(item.quantity)} ={' '}
                            {formatCurrency(
                              (parseAmount(item.cutterPayAmount) ||
                                staffRateForGarment(item.sizing.garmentType, 'cutter')) *
                                parseLineQuantity(item.quantity),
                            )}
                          </p>
                        ) : cutters.length > 0 ? (
                          <p className="self-end pb-2 text-xs text-slate-400">
                            Assign cutter to set payout
                          </p>
                        ) : null}
                        {tailors.length > 0 ? (
                          <Select
                            label="Tailor"
                            value={item.tailorId}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                items: form.items.map((row) =>
                                  row.id === item.id
                                    ? {
                                        ...row,
                                        tailorId: e.target.value,
                                        tailorPayAmount: e.target.value
                                          ? String(staffRateForGarment(item.sizing.garmentType, 'tailor') || row.tailorPayAmount)
                                          : '',
                                      }
                                    : row,
                                ),
                              })
                            }
                          >
                            <option value="">Assign later</option>
                            {tailors.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </Select>
                        ) : null}
                        {item.tailorId ? (
                          <p className="self-end pb-3 text-xs font-medium text-slate-600">
                            {tailorName ? `${tailorName}: ` : 'Tailor: '}
                            {formatCurrency(parseAmount(item.tailorPayAmount) || staffRateForGarment(item.sizing.garmentType, 'tailor'))}{' '}
                            × {parseLineQuantity(item.quantity)} ={' '}
                            {formatCurrency(
                              (parseAmount(item.tailorPayAmount) ||
                                staffRateForGarment(item.sizing.garmentType, 'tailor')) *
                                parseLineQuantity(item.quantity),
                            )}
                          </p>
                        ) : tailors.length > 0 ? (
                          <p className="self-end pb-2 text-xs text-slate-400">
                            Assign tailor to set payout
                          </p>
                        ) : null}
                        <Input
                          label="Cutter by"
                          type="date"
                          value={item.cutterExpectedDate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              items: form.items.map((row) =>
                                row.id === item.id ? { ...row, cutterExpectedDate: e.target.value } : row,
                              ),
                            })
                          }
                        />
                        <Input
                          label="Tailor by"
                          type="date"
                          value={item.tailorExpectedDate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              items: form.items.map((row) =>
                                row.id === item.id ? { ...row, tailorExpectedDate: e.target.value } : row,
                              ),
                            })
                          }
                          min={todayDateString()}
                        />
                        {extraStaffTypes.map((role) => {
                          const members = staff.filter((member) => member.type === role.slug);
                          if (members.length === 0) return null;
                          const slot = item.extraStaff?.[role.slug] ?? { staffId: '', payAmount: '' };
                          const qty = parseLineQuantity(item.quantity);
                          const rate =
                            parseAmount(slot.payAmount) ||
                            staffRateForGarment(item.sizing.garmentType, role.slug);
                          return (
                            <div key={role.slug} className="col-span-2 grid grid-cols-2 gap-3">
                              <Select
                                label={role.label}
                                value={slot.staffId}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    items: form.items.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            extraStaff: {
                                              ...(row.extraStaff ?? {}),
                                              [role.slug]: {
                                                staffId: e.target.value,
                                                payAmount: e.target.value
                                                  ? String(staffRateForGarment(item.sizing.garmentType, role.slug))
                                                  : '',
                                              },
                                            },
                                          }
                                        : row,
                                    ),
                                  })
                                }
                              >
                                <option value="">Assign later</option>
                                {members.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                              </Select>
                              {slot.staffId ? (
                                <p className="self-end pb-3 text-xs font-medium text-slate-600">
                                  {formatCurrency(rate)} × {qty} = {formatCurrency(rate * qty)}
                                </p>
                              ) : (
                                <p className="self-end pb-2 text-xs text-slate-400">
                                  Assign {staffTypeLabel(role.slug).toLowerCase()} to set payout
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}

            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full py-2.5 text-sm sm:w-auto sm:px-5"
              onClick={() => {
                const last = form.items[form.items.length - 1];
                setForm({
                  ...form,
                  items: [
                    ...form.items,
                    newClothLineItem({
                      cutterId: last?.cutterId,
                      tailorId: last?.tailorId,
                      cutterExpectedDate: last?.cutterExpectedDate,
                      tailorExpectedDate: last?.tailorExpectedDate,
                      cutterPayAmount: last?.cutterPayAmount,
                      tailorPayAmount: last?.tailorPayAmount,
                      extraStaff: last?.extraStaff,
                    }),
                  ],
                });
              }}
            >
              <Plus className="h-4 w-4" />
              Add another cloth
            </Button>

            <p className="text-xs text-slate-500">
              Qty 2 of the same cloth prints as one staff ticket. Different cloths or staff still print
              separately. Customer payment is split evenly across pieces.
            </p>
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any special instructions"
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Input
              label="Order date"
              type="date"
              value={form.givenDate}
              onChange={(e) => setForm({ ...form, givenDate: e.target.value })}
              required
            />
            <Input
              label="Delivery date"
              type="date"
              value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
              min={form.givenDate || undefined}
            />
            <Input
              label="Total Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              placeholder="2500"
            />
            <Input
              label="Advance (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.advanceAmount}
              onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
              placeholder="1000"
            />
            <Input
              label="Discount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.discountAmount}
              onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
              placeholder="0"
            />
          </div>
          {!hasStaff && (
            <p className="-mt-1 text-xs text-slate-500">
              Apply a discount when registering without staff on the order.
            </p>
          )}
          {actionError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{actionError}</p>
          )}
          <Button type="submit" disabled={saving} className="w-full rounded-full py-3.5">
            {saving
              ? 'Saving...'
              : registerPieceCount > 1
                ? `Save All (${registerPieceCount} pieces)`
                : 'Save All'}
          </Button>
        </form>
      </Modal>

      {manageClothLive && (
        <ClothManageSheet
          cloth={manageClothLive}
          orderCloths={getCustomerOrderCloths(manageClothLive, allCloths)}
          staff={staff}
          onClose={() => setManageCloth(null)}
          onUpdated={handleUpdated}
          onShowBarcode={() => {
            setPrintOrderCloths([manageClothLive]);
            setManageCloth(null);
          }}
        />
      )}

      {savedCloths && (
        <RegisterPrintPrompt
          cloths={savedCloths}
          onPrintStaffBarcodes={() => setPrintOrderCloths(savedCloths)}
          onPrintBill={() => setBillCloths(savedCloths)}
          onClose={() => setSavedCloths(null)}
        />
      )}

      {billCloths && (
        <CustomerBillPrintSheet
          cloths={billCloths}
          onClose={() => setBillCloths(null)}
          onPrintBarcodes={() => {
            setPrintOrderCloths(billCloths);
            setBillCloths(null);
          }}
        />
      )}

      {printOrderCloths && printOrderCloths.length > 0 && (
        <BarcodePrintSheet
          cloths={printOrderCloths}
          staff={staff}
          onClose={() => setPrintOrderCloths(null)}
        />
      )}
    </div>
  );
}

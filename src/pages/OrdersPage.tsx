import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Circle, Phone, Plus, Printer, Receipt, Search, Settings2, Trash2, UserCog } from 'lucide-react';
import { assignCutter, assignStaffJob, assignTailor, deleteCloths, getStaffById, registerClothOrder, setClothDone } from '../lib/data';
import { useClothList } from '../hooks/useClothList';
import {
  CLOTH_FILTER_OPTIONS,
  clothMatchesSearch,
  type ClothStatusFilter,
} from '../lib/cloth-list';
import {
  type Cloth,
  type Staff,
} from '../types';
import { clothStageBadge, orderStageBadge } from '../lib/cloth-status';
import { formatDate, formatCalendarDate, isPastDue, todayDateString, clothBillName } from '../lib/utils';
import { formatCurrency, parseAmount, summarizePayments } from '../lib/payments';
import { BarcodePrintSheet } from '../components/BarcodePrintSheet';
import { CustomerBillPrintSheet } from '../components/CustomerBillPrintSheet';
import { RegisterPrintPrompt } from '../components/RegisterPrintPrompt';
import {
  getCustomerOrderCloths,
  getOrderRepresentatives,
  groupClothsForCustomerBill,
  groupClothsForStaffTickets,
  resolveOrderCodeMap,
  customerOrderKey,
  clothCodeRange,
  orderMatchesBoard,
  parseOrderBoard,
  type OrderBoard,
} from '../lib/customer-order';
import { ClothManageSheet } from '../components/ClothManageSheet';
import { GarmentSizingForm, emptyGarmentSizing } from '../components/GarmentSizingForm';
import type { MeasurementData } from '../lib/measurements';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { garmentDisplayLabel, getGarmentType } from '../lib/garments';
import { formatMeasurementsSummary } from '../lib/measurements';
import { findCustomerOnPhone, latestSizingForCustomer, listCustomersByPhone, suggestCustomersByPhone } from '../lib/customer-history';
import { emptyStaffJob, staffRateForGarment } from '../lib/staff-jobs';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import {
  customerTelHref,
  dialCustomerPhone,
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
  notes: string;
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
      | 'notes'
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
    notes: defaults?.notes ?? '',
  };
}

function parseLineQuantity(value: string) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 1;
}

function registerStaffOwedCopy(args: {
  assigned: boolean;
  rate: number;
  qty: number;
  role: string;
  garmentLabel: string;
}) {
  if (!args.assigned) return 'No payout until you assign';
  if (!(args.rate > 0)) {
    return 'Set staff rate for this cloth type, else they won’t appear as payable';
  }
  return `This ${args.role} will be owed ${formatCurrency(args.rate * args.qty)} for ${args.qty} ${args.garmentLabel}`;
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

const BOARD_COPY: Record<OrderBoard, { title: string; subtitle: string; empty: string; emptyHint: string }> = {
  all: {
    title: 'All orders',
    subtitle: 'Every order in one list. Filter by stage when you need it.',
    empty: 'No orders yet',
    emptyHint: 'Register a cloth to start the workflow',
  },
  pending: {
    title: 'Pending orders',
    subtitle: 'Work still in the shop. Register a new order here.',
    empty: 'No pending orders',
    emptyHint: 'Register a cloth to start the workflow',
  },
  done: {
    title: 'Done orders',
    subtitle: 'Finished orders, kept off the pending list.',
    empty: 'No done orders',
    emptyHint: 'Completed orders will show here',
  },
  payments: {
    title: 'Pending payments',
    subtitle: 'Orders with money still due. Call the customer from the row.',
    empty: 'No pending payments',
    emptyHint: 'Orders with a balance will show here',
  },
};

function CompactStaffSelect({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      searchable={false}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </Select>
  );
}

function ClothListItem({
  cloth,
  staff,
  allCloths,
  orderCode,
  showCall,
  onReprint,
  onPrintBill,
  onManage,
  onAssigned,
  onDeleted,
}: {
  cloth: Cloth;
  staff: Staff[];
  allCloths: Cloth[];
  orderCode: string;
  showCall?: boolean;
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
  const stage = orderStageBadge(orderCloths);
  const cutter = getStaffById(staff, cloth.cutterId);
  const tailor = getStaffById(staff, cloth.tailorId);
  const cutterOverdue =
    cloth.status === 'cutting' && isPastDue(cloth.cutterExpectedDate, false);
  const tailorOverdue =
    cloth.status === 'sewing' && isPastDue(cloth.tailorExpectedDate, false);

  const { types: staffRoleTypes } = useStaffTypes();
  const extraStaffTypes = staffRoleTypes.filter((item) => item.slug !== 'cutter' && item.slug !== 'tailor');
  const cutters = staff.filter((m) => m.type === 'cutter');
  const tailors = staff.filter((m) => m.type === 'tailor');
  const [assignOpen, setAssignOpen] = useState(false);
  const [piecesOpen, setPiecesOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<
    Record<string, { cutterId?: string; tailorId?: string; extra?: Record<string, string> }>
  >({});
  const [assignError, setAssignError] = useState<string | null>(null);
  const [doneBusy, setDoneBusy] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDone = cloth.status === 'completed';

  function cutterValue(piece: Cloth) {
    return assignDraft[piece.id]?.cutterId ?? piece.cutterId ?? '';
  }

  function tailorValue(piece: Cloth) {
    return assignDraft[piece.id]?.tailorId ?? piece.tailorId ?? '';
  }

  function extraValue(piece: Cloth, type: string) {
    return (
      assignDraft[piece.id]?.extra?.[type] ??
      (piece.staffJobs ?? []).find((job) => job.type === type)?.staffId ??
      ''
    );
  }

  async function handleAssignCutter(piece: Cloth, value: string) {
    const previous = cutterValue(piece);
    setAssignDraft((current) => ({
      ...current,
      [piece.id]: { ...current[piece.id], cutterId: value },
    }));
    setAssignError(null);
    try {
      await assignCutter(piece.id, value || null);
      await onAssigned();
    } catch (err) {
      setAssignDraft((current) => ({
        ...current,
        [piece.id]: { ...current[piece.id], cutterId: previous },
      }));
      setAssignError(err instanceof Error ? err.message : 'Failed to assign cutter');
    }
  }

  async function handleAssignTailor(piece: Cloth, value: string) {
    const previous = tailorValue(piece);
    setAssignDraft((current) => ({
      ...current,
      [piece.id]: { ...current[piece.id], tailorId: value },
    }));
    setAssignError(null);
    try {
      const startSewing = piece.status === 'ready_to_sew' || piece.status === 'sewing';
      await assignTailor(piece.id, value || null, piece.tailorExpectedDate ?? null, {
        startSewing: startSewing && Boolean(value),
      });
      await onAssigned();
    } catch (err) {
      setAssignDraft((current) => ({
        ...current,
        [piece.id]: { ...current[piece.id], tailorId: previous },
      }));
      setAssignError(err instanceof Error ? err.message : 'Failed to assign tailor');
    }
  }

  async function handleAssignExtra(piece: Cloth, type: string, value: string) {
    const previous = extraValue(piece, type);
    setAssignDraft((current) => ({
      ...current,
      [piece.id]: {
        ...current[piece.id],
        extra: { ...current[piece.id]?.extra, [type]: value },
      },
    }));
    setAssignError(null);
    try {
      await assignStaffJob(piece, type, value || null);
      await onAssigned();
    } catch (err) {
      setAssignDraft((current) => ({
        ...current,
        [piece.id]: {
          ...current[piece.id],
          extra: { ...current[piece.id]?.extra, [type]: previous },
        },
      }));
      setAssignError(err instanceof Error ? err.message : 'Failed to assign staff');
    }
  }

  async function handleAssignAll(role: 'cutter' | 'tailor', value: string) {
    setAssignError(null);
    try {
      for (const piece of orderCloths) {
        if (role === 'cutter') await handleAssignCutter(piece, value);
        else await handleAssignTailor(piece, value);
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign staff');
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

  const garmentLines = groupClothsForCustomerBill(orderCloths);
  const pieceCodes = clothCodeRange(orderCloths.map((piece) => piece.code));
  const telHref = cloth.customerPhone ? customerTelHref(cloth.customerPhone) : null;

  return (
    <Card className={`ticket-stub p-0 ${assignOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{cloth.customerName || 'Unknown'}</p>
          {cloth.customerPhone ? (
            <p className="truncate text-xs text-slate-400">{cloth.customerPhone}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showCall && telHref ? (
            <a
              href={telHref}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-3 text-xs font-semibold text-white hover:bg-action-deep active:scale-[0.97]"
              onClick={(event) => {
                if (!window.tailorDesktop?.openExternal) return;
                event.preventDefault();
                dialCustomerPhone(cloth.customerPhone);
              }}
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          ) : null}
          <Badge className={`shrink-0 ${stage.className}`}>
            {stage.label}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 text-xs text-slate-500">
        <span className="font-mono text-sm font-semibold tracking-wide text-ink">{orderCode}</span>
        <span>
          {orderPieceCount} piece{orderPieceCount === 1 ? '' : 's'}
        </span>
        {orderPieceCount === 1 && (
          <span className="font-mono text-ink">{cloth.code}</span>
        )}
        {orderPieceCount === 1 && cutter && <span>Cutter: {cutter.name}</span>}
        {orderPieceCount === 1 && tailor && <span>Tailor: {tailor.name}</span>}
        {cloth.givenDate && <span>Order: {formatCalendarDate(cloth.givenDate)}</span>}
        {cloth.deliveryDate && <span>Delivery: {formatCalendarDate(cloth.deliveryDate)}</span>}
        {orderPieceCount === 1 && cloth.cutterExpectedDate && (
          <span className={cutterOverdue ? 'font-semibold text-rose-600' : ''}>
            Cutter by: {formatCalendarDate(cloth.cutterExpectedDate)}
            {cutterOverdue ? ' (overdue)' : ''}
          </span>
        )}
        {orderPieceCount === 1 && cloth.tailorExpectedDate && (
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

      <div className="mt-2 flex flex-wrap gap-1.5 px-4">
        {garmentLines.map((item) => (
          <span
            key={item.name}
            className="inline-flex max-w-full items-center rounded-full border border-seam bg-paper px-2.5 py-0.5 text-[11px] font-medium text-ink"
          >
            <span className="truncate">{item.name}</span>
            {item.quantity > 1 ? (
              <span className="ml-1 tabular-nums text-ink-muted">×{item.quantity}</span>
            ) : null}
          </span>
        ))}
      </div>

      {orderPieceCount > 1 && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => setPiecesOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-xs font-medium text-action"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition ${piecesOpen ? 'rotate-180' : ''}`} />
            {piecesOpen ? 'Hide cloths' : `Cloths ${pieceCodes}`}
          </button>
          {piecesOpen && (
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-seam bg-paper/70 p-2">
              {orderCloths.map((piece) => {
                const pieceStage = clothStageBadge(piece);
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => onManage(piece)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white"
                  >
                    <span className="w-16 shrink-0 font-mono text-[11px] font-semibold text-ink">
                      {piece.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                      {clothBillName(piece)}
                    </span>
                    <Badge className={`shrink-0 ${pieceStage.className}`}>
                      {pieceStage.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 bg-white px-4 pt-4 pb-3">
        <Button
          size="sm"
          variant={assignOpen ? 'primary' : 'secondary'}
          onClick={() => setAssignOpen((v) => !v)}
        >
          <UserCog className="h-3.5 w-3.5" />
          Assign
        </Button>
        <Button size="sm" variant="primary" onClick={() => onManage(cloth)}>
          <Settings2 className="h-3.5 w-3.5" />
          Manage
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onPrintBill(orderCloths)}>
          <Receipt className="h-3.5 w-3.5" />
          {orderPieceCount > 1 ? `Print bill (${orderPieceCount})` : 'Print bill'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onReprint(orderCloths)}>
          <Printer className="h-3.5 w-3.5" />
          {staffTicketCount > 1 ? `Staff barcode (${staffTicketCount})` : 'Staff barcode'}
        </Button>
        {orderPieceCount === 1 && (
        <Button
          size="sm"
          variant={isDone ? 'primary' : 'secondary'}
          onClick={() => void handleToggleDone()}
          disabled={doneBusy}
          className={isDone ? 'bg-done hover:bg-done/90' : undefined}
        >
          {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {doneBusy ? 'Saving...' : isDone ? 'Done' : 'Mark done'}
        </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void handleDeleteOrder()}
          disabled={deleteBusy}
          className="border border-overdue/25 bg-overdue/10 text-overdue hover:bg-overdue/15 hover:text-overdue"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleteBusy ? 'Deleting...' : orderPieceCount > 1 ? 'Delete order' : 'Delete'}
        </Button>
      </div>

      {deleteError && (
        <p className="mx-4 mb-3 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{deleteError}</p>
      )}

      {doneError && (
        <p className="mx-4 mb-3 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{doneError}</p>
      )}

      {assignOpen && (
        <div className="mx-4 mb-4 rounded-xl border border-seam bg-white p-3 sm:p-4">
          {assignError && (
            <p className="mb-3 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{assignError}</p>
          )}
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Assign staff</p>
            {orderPieceCount > 1 ? (
              <p className="text-xs text-ink-muted">{orderPieceCount} clothes</p>
            ) : null}
          </div>
          {orderPieceCount > 1 && (
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-paper/80 p-3">
              <CompactStaffSelect
                label="Cutter for all"
                value="__skip"
                disabled={cutters.length === 0}
                onChange={(value) => {
                  if (value === '__skip') return;
                  void handleAssignAll('cutter', value === '__none' ? '' : value);
                }}
              >
                <option value="__skip">Choose…</option>
                <option value="__none">None</option>
                {cutters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </CompactStaffSelect>
              <CompactStaffSelect
                label="Tailor for all"
                value="__skip"
                disabled={tailors.length === 0}
                onChange={(value) => {
                  if (value === '__skip') return;
                  void handleAssignAll('tailor', value === '__none' ? '' : value);
                }}
              >
                <option value="__skip">Choose…</option>
                <option value="__none">None</option>
                {tailors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </CompactStaffSelect>
            </div>
          )}
          <div className="divide-y divide-seam">
            {orderCloths.map((piece) => (
              <div
                key={piece.id}
                className={orderPieceCount > 1 ? 'grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(7rem,0.9fr)_1fr_1fr] sm:items-end' : 'grid grid-cols-2 gap-3'}
              >
                {orderPieceCount > 1 && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{clothBillName(piece)}</p>
                    <p className="font-mono text-xs text-ink-muted">{piece.code}</p>
                  </div>
                )}
                <CompactStaffSelect
                  label="Cutter"
                  value={cutterValue(piece)}
                  disabled={cutters.length === 0}
                  onChange={(value) => void handleAssignCutter(piece, value)}
                >
                  <option value="">None</option>
                  {cutters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </CompactStaffSelect>
                <CompactStaffSelect
                  label="Tailor"
                  value={tailorValue(piece)}
                  disabled={tailors.length === 0}
                  onChange={(value) => void handleAssignTailor(piece, value)}
                >
                  <option value="">None</option>
                  {tailors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </CompactStaffSelect>
                {extraStaffTypes.map((role) => {
                  const members = staff.filter((member) => member.type === role.slug);
                  if (members.length === 0) return null;
                  return (
                    <div key={role.slug} className={orderPieceCount > 1 ? 'sm:col-span-3' : 'col-span-2'}>
                      <CompactStaffSelect
                        label={role.label}
                        value={extraValue(piece, role.slug)}
                        onChange={(value) => void handleAssignExtra(piece, role.slug, value)}
                      >
                        <option value="">None</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </CompactStaffSelect>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function OrdersPage() {
  const { board: boardParam } = useParams();
  const board = parseOrderBoard(boardParam);

  const {
    allCloths,
    staff,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    statusCounts,
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
  const orderCodeMap = useMemo(() => resolveOrderCodeMap(allCloths), [allCloths]);
  const boardOrders = useMemo(() => {
    if (!board) return [];
    return getOrderRepresentatives(allCloths, allCloths).filter((rep) => {
      const order = getCustomerOrderCloths(rep, allCloths);
      if (!orderMatchesBoard(order, board)) return false;
      if (board === 'all' && statusFilter !== 'all' && !order.some((piece) => piece.status === statusFilter)) {
        return false;
      }
      if (!search.trim()) return true;
      return order.some((piece) => clothMatchesSearch(piece, search));
    });
  }, [allCloths, board, search, statusFilter]);
  const phoneSuggestions = useMemo(
    () => suggestCustomersByPhone(allCloths, form.customerPhone),
    [allCloths, form.customerPhone],
  );
  const familyOnPhone = useMemo(
    () => listCustomersByPhone(allCloths, form.customerPhone),
    [allCloths, form.customerPhone],
  );
  const matchedCustomer = findCustomerOnPhone(allCloths, form.customerName, form.customerPhone);

  function applyCustomerDetails(name: string, phone = form.customerPhone) {
    const nextPhone = phone;
    const nextName = name;
    setForm((current) => ({
      ...current,
      customerName: nextName,
      customerPhone: nextPhone,
      items: current.items.map((item) => {
        if (!item.sizing.garmentType) {
          return item;
        }
        const remembered = latestSizingForCustomer(
          allCloths,
          nextName,
          nextPhone,
          item.sizing.garmentType,
        );
        if (!remembered) {
          return {
            ...item,
            sizing: { ...item.sizing, measurements: {} },
          };
        }
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

  function startNewFamilyMember() {
    applyCustomerDetails('', form.customerPhone);
    setPhoneSuggestOpen(false);
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
            notes: item.notes.trim() || form.notes,
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
    ? allCloths.find((c) => c.id === manageCloth.id) ?? manageCloth
    : null;

  if (!board) {
    return <Navigate to="/orders/all" replace />;
  }

  const canRegister = board === 'all' || board === 'pending';

  const copy = BOARD_COPY[board];

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
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          canRegister ? (
            <Button onClick={() => setOpen(true)} className="shrink-0 px-4">
              <Plus className="h-4 w-4" />
              New order
            </Button>
          ) : undefined
        }
      />

      {(error || actionError) && (
        <Card className="mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error ?? actionError}
        </Card>
      )}

      {canRegister && !hasStaff && (
        <Card className="mb-4 border-sky-200 bg-sky-50 text-sm text-sky-800">
          No staff added yet — you can still register cloth and apply a customer discount. Assign cutter/tailor later from Staff or Scanner.
        </Card>
      )}

      {canRegister && hasStaff && cutters.length === 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
          Add a <strong>Cloth Cutter</strong> in Staff to assign cutting work, or register without a cutter for now.
        </Card>
      )}

      {canRegister && hasStaff && tailors.length === 0 && (
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
            placeholder="Search order number, name, or mobile"
            data-allow-typing
            className="w-full rounded-[10px] border border-seam bg-paper py-3 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brass focus:bg-ticket focus:ring-2 focus:ring-brass/25"
          />
        </label>

        {board === 'all' ? (
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
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <p className="text-xs font-medium text-slate-500">
            {boardOrders.length} order{boardOrders.length === 1 ? '' : 's'}
          </p>
          {search || (board === 'all' && statusFilter !== 'all') ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-action active:opacity-70"
            >
              {board === 'all' && statusFilter !== 'all' ? 'Clear filters' : 'Clear search'}
            </button>
          ) : null}
        </div>
      </Card>

      {boardOrders.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-slate-700">{search ? 'No orders match this search' : copy.empty}</p>
          <p className="mt-1 text-sm text-slate-500">
            {search ? 'Try another name, mobile, or order number' : copy.emptyHint}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {boardOrders.map((cloth) => (
            <ClothListItem
              key={getCustomerOrderCloths(cloth, allCloths)[0]?.id ?? cloth.id}
              cloth={cloth}
              staff={staff}
              allCloths={allCloths}
              orderCode={orderCodeMap.get(customerOrderKey(cloth)) ?? cloth.orderCode ?? cloth.code}
              showCall={board === 'payments'}
              onReprint={setPrintOrderCloths}
              onPrintBill={setBillCloths}
              onManage={setManageCloth}
              onAssigned={handleUpdated}
              onDeleted={handleUpdated}
            />
          ))}
        </div>
      )}

      <Modal open={open} title="Register Cloth" size="wide" onClose={() => setOpen(false)}>
        <form
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== 'NumpadEnter') return;
            const target = event.target;
            if (target instanceof HTMLTextAreaElement) return;
            if (target instanceof HTMLButtonElement && target.type === 'submit') return;
            event.preventDefault();
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Customer Name"
              value={form.customerName}
              onChange={(e) => {
                const name = e.target.value;
                const member = findCustomerOnPhone(allCloths, name, form.customerPhone);
                if (member) {
                  applyCustomerDetails(member.name, member.phone);
                  return;
                }
                setForm({ ...form, customerName: name });
              }}
              placeholder="Person's name"
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
                  const members = listCustomersByPhone(allCloths, phone);
                  if (members.length === 1 && members[0]) {
                    applyCustomerDetails(members[0].name, members[0].phone);
                    return;
                  }
                  if (members.length > 1) {
                    const typed = members.find(
                      (member) =>
                        member.name.trim().toLowerCase() === form.customerName.trim().toLowerCase(),
                    );
                    if (typed) {
                      applyCustomerDetails(typed.name, typed.phone);
                      return;
                    }
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
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-paper"
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
          <p className="-mt-2 text-xs text-slate-500">
            Type a mobile number and pick the person. The same number can have several family members with
            their own sizes. A new save always creates a new order.
          </p>
          {familyOnPhone.length > 0 ? (
            <div className="-mt-1 space-y-2">
              <p className="text-xs font-medium text-ink-soft">
                {familyOnPhone.length === 1
                  ? 'Person on this number'
                  : `${familyOnPhone.length} people on this number — pick who this order is for`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {familyOnPhone.map((member) => {
                  const selected =
                    member.name.trim().toLowerCase() === form.customerName.trim().toLowerCase();
                  return (
                    <button
                      key={`${member.phone}-${member.name}`}
                      type="button"
                      onClick={() => applyCustomerDetails(member.name, member.phone)}
                      className={`min-h-11 rounded-full border px-3 text-sm font-semibold transition ${
                        selected
                          ? 'border-action bg-action text-white'
                          : 'border-seam bg-white text-ink hover:bg-paper'
                      }`}
                    >
                      {member.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={startNewFamilyMember}
                  className="min-h-11 rounded-full border border-dashed border-seam bg-white px-3 text-sm font-semibold text-ink-soft hover:border-action hover:text-action"
                >
                  Add family member
                </button>
              </div>
            </div>
          ) : null}
          {matchedCustomer ? (
            <p className="-mt-1 text-xs font-medium text-action">
              Using {matchedCustomer.name}
              {matchedCustomer.phone ? ` · ${matchedCustomer.phone}` : ''}. Select a cloth type to fill
              this person’s last saved sizes.
            </p>
          ) : familyOnPhone.length > 0 && !form.customerName.trim() ? (
            <p className="-mt-1 text-xs font-medium text-ink-muted">
              Type a new name for another family member, then enter their sizes.
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Clothes</p>
              <span className="text-xs font-medium text-action">
                {registerPieceCount} piece{registerPieceCount === 1 ? '' : 's'} total
              </span>
            </div>

            {form.items.map((item, index) => {
              const lineQty = parseLineQuantity(item.quantity);
              const garmentLabel =
                getGarmentType(item.sizing.garmentType)?.label || 'cloth';
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

                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
                            searchable={false}
                            placeholder="Assign later"
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
                            {registerStaffOwedCopy({
                              assigned: true,
                              rate:
                                parseAmount(item.cutterPayAmount) ||
                                staffRateForGarment(item.sizing.garmentType, 'cutter'),
                              qty: lineQty,
                              role: 'cutter',
                              garmentLabel,
                            })}
                          </p>
                        ) : cutters.length > 0 ? (
                          <p className="self-end pb-2 text-xs text-slate-400">
                            No payout until you assign
                          </p>
                        ) : null}
                        {tailors.length > 0 ? (
                          <Select
                            label="Tailor"
                            value={item.tailorId}
                            searchable={false}
                            placeholder="Assign later"
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
                            {registerStaffOwedCopy({
                              assigned: true,
                              rate:
                                parseAmount(item.tailorPayAmount) ||
                                staffRateForGarment(item.sizing.garmentType, 'tailor'),
                              qty: lineQty,
                              role: 'tailor',
                              garmentLabel,
                            })}
                          </p>
                        ) : tailors.length > 0 ? (
                          <p className="self-end pb-2 text-xs text-slate-400">
                            No payout until you assign
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
                                searchable={false}
                                placeholder="Assign later"
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
                                  {registerStaffOwedCopy({
                                    assigned: true,
                                    rate,
                                    qty,
                                    role: staffTypeLabel(role.slug).toLowerCase(),
                                    garmentLabel,
                                  })}
                                </p>
                              ) : (
                                <p className="self-end pb-2 text-xs text-slate-400">
                                  No payout until you assign
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <Textarea
                  label="Special note"
                  value={item.notes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      items: form.items.map((row) =>
                        row.id === item.id ? { ...row, notes: e.target.value } : row,
                      ),
                    })
                  }
                  placeholder="Instructions for this cloth (prints on the staff ticket)"
                />
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
              Qty 2 of the same cloth prints as one staff ticket. Different cloths, staff, or special
              notes still print separately. Customer payment is split evenly across pieces.
            </p>
          </div>

          <Textarea
            label="Order note"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Used on every cloth that has no special note of its own"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          allCloths={allCloths}
          staff={staff}
          onClose={() => setManageCloth(null)}
          onUpdated={handleUpdated}
          onShowBarcode={() => {
            setPrintOrderCloths(getCustomerOrderCloths(manageClothLive, allCloths));
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

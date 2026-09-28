import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, ChevronLeft, ChevronRight, Hash, ScanLine } from 'lucide-react';
import { ensureCameraAccess } from '../lib/camera-permissions';
import {
  getClothByCode,
  getStaffByType,
  listClothsByOrderCode,
} from '../lib/data';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAppData } from '../hooks/useAppData';
import { useHardwareScannerBusOptional, refocusScannerCapture } from '../contexts/HardwareScannerContext';
import { isDesktopApp, supportsCameraScanner, supportsHardwareScanner } from '../lib/platform';
import { isScanTerminatorKey, normalizeScannerBarcode } from '../lib/scanner-input';
import { PaymentDashboard } from '../components/PaymentDashboard';
import { ScanBasketPanel } from '../components/ScanBasketPanel';
import { type Cloth } from '../types';
import { orderStageBadge } from '../lib/cloth-status';
import { Badge, Button, Card, Input, Modal, PageHeader, showToast } from '../components/ui';
import { formatCalendarDate, isPastDue, todayDateString, clothBillName } from '../lib/utils';
import {
  getCustomerOrderCloths,
  getOrderRepresentatives,
  summarizeCustomerOrder,
  groupClothsForCustomerBill,
  customerBillItemLabel,
} from '../lib/customer-order';
import { formatCurrency } from '../lib/payments';
import { ClothManageSheet } from '../components/ClothManageSheet';
import {
  applyScanToSession,
  classifyScanCloth,
  expandScannedCloths,
  looksLikeOrderCode,
  otherStageMessage,
  scanAddToast,
  sessionModalTitle,
  customerBillLookupCode,
  type ScanBasketKind,
} from '../lib/scan-basket';
import {
  clothDoneOnDay,
  clothMatchesShopDate,
  filterShopCloths,
  shopStaffLoads,
  shopWorkCounts,
  todayBoardCloths,
  type ShopStageFilter,
} from '../lib/shop-work';

type ScanStep = 'idle' | 'scanning' | 'result' | 'customer';

const HOME_STAGE_FILTERS: { id: ShopStageFilter; label: string }[] = [
  { id: 'all', label: 'Due & done' },
  { id: 'cutting', label: 'Cutting' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'tailoring', label: 'Tailoring' },
  { id: 'done', label: 'Done' },
];

const HOME_PAGE_SIZE = 8;

function orderAccentClass(orderCloths: Cloth[]) {
  const finished = orderCloths.every((item) => item.status === 'completed');
  if (finished) return 'bg-done';
  if (orderCloths.some((item) => isPastDue(item.deliveryDate, item.status === 'completed'))) return 'bg-overdue';
  if (orderCloths.some((item) => item.status === 'sewing' || item.status === 'ready_to_sew')) return 'bg-sew';
  return 'bg-cut';
}

function HomeOrderRows({
  pieces,
  allCloths,
  empty,
  onOpen,
}: {
  pieces: Cloth[];
  allCloths: Cloth[];
  empty: string;
  onOpen: (code: string) => void;
}) {
  const [page, setPage] = useState(0);
  const sorted = [...pieces].sort(
    (a, b) =>
      (a.deliveryDate || a.givenDate || '').localeCompare(b.deliveryDate || b.givenDate || '') ||
      a.customerName.localeCompare(b.customerName),
  );
  const rows = getOrderRepresentatives(sorted, allCloths);
  const pageCount = Math.max(1, Math.ceil(rows.length / HOME_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * HOME_PAGE_SIZE, safePage * HOME_PAGE_SIZE + HOME_PAGE_SIZE);

  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-ink-muted">{empty}</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-1">
        {visible.map((rep) => {
          const orderCloths = getCustomerOrderCloths(rep, allCloths);
          const summary = summarizeCustomerOrder(orderCloths);
          const stage = orderStageBadge(orderCloths);
          const overdue = isPastDue(summary.deliveryDate, orderCloths.every((item) => item.status === 'completed'));
          return (
            <li key={rep.id}>
              <button
                type="button"
                onClick={() => onOpen(rep.code)}
                className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition hover:bg-linen"
              >
                <span className={`h-9 w-1 shrink-0 rounded-full ${orderAccentClass(orderCloths)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{summary.customerName}</p>
                    <Badge className={`shrink-0 ${stage.className}`}>{stage.label}</Badge>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                    {summary.orderCode || rep.code}
                    {summary.pieceCount > 1 ? ` · ${summary.pieceCount} pcs` : ` · ${rep.code}`}
                    {summary.deliveryDate
                      ? ` · ${overdue ? 'Overdue' : 'Due'} ${formatCalendarDate(summary.deliveryDate)}`
                      : summary.givenDate
                        ? ` · ${formatCalendarDate(summary.givenDate)}`
                        : ''}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-seam pt-3">
          <p className="text-xs text-ink-muted">
            {safePage * HOME_PAGE_SIZE + 1}–{Math.min(rows.length, (safePage + 1) * HOME_PAGE_SIZE)} of {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScannerPage() {
  const { cloths, staff, loading, error, refetch } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [step, setStep] = useState<ScanStep>('idle');
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [homeStage, setHomeStage] = useState<ShopStageFilter>('all');
  const [homeDate, setHomeDate] = useState(todayDateString);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const hardwareScanner = supportsHardwareScanner();
  const cameraScanner = supportsCameraScanner() && !isDesktopApp();
  const scannerBus = useHardwareScannerBusOptional();
  const scannerConnected = Boolean(hardwareScanner && scannerBus?.enabled);
  const [basketIds, setBasketIds] = useState<string[]>([]);
  const [customerOrderIds, setCustomerOrderIds] = useState<string[]>([]);
  const [manageFromScan, setManageFromScan] = useState<Cloth | null>(null);
  const basketIdsRef = useRef<string[]>([]);
  const sessionKindRef = useRef<ScanBasketKind | null>(null);
  const handleScanRef = useRef<(code: string) => Promise<void>>(async () => {});

  const tailors = getStaffByType(staff, 'tailor');
  const cutters = getStaffByType(staff, 'cutter');
  const counts = useMemo(() => shopWorkCounts(cloths), [cloths]);
  const staffLoads = useMemo(() => shopStaffLoads(cloths, staff), [cloths, staff]);
  const todayBoard = useMemo(
    () => todayBoardCloths(cloths, homeDate || todayDateString()),
    [cloths, homeDate],
  );
  const filteredHomeCloths = useMemo(() => {
    if (homeStage === 'all') {
      return homeDate ? todayBoard.pieces : cloths;
    }
    if (homeStage === 'done' && homeDate) {
      return cloths.filter(
        (cloth) =>
          cloth.status === 'completed' &&
          (clothDoneOnDay(cloth, homeDate) || clothMatchesShopDate(cloth, homeDate)),
      );
    }
    return [...filterShopCloths(cloths, homeStage, homeDate)].sort(
      (a, b) =>
        (b.deliveryDate || b.givenDate || b.createdAt).localeCompare(a.deliveryDate || a.givenDate || a.createdAt),
    );
  }, [cloths, homeStage, homeDate, todayBoard.pieces]);

  const scanLockRef = useRef(false);
  const basket = useMemo(() => {
    const byId = new Map(cloths.map((item) => [item.id, item]));
    return basketIds
      .map((id) => byId.get(id))
      .filter((item): item is Cloth => Boolean(item));
  }, [basketIds, cloths]);
  const customerOrder = useMemo(() => {
    const byId = new Map(cloths.map((item) => [item.id, item]));
    return customerOrderIds
      .map((id) => byId.get(id))
      .filter((item): item is Cloth => Boolean(item));
  }, [customerOrderIds, cloths]);
  const customerBill = useMemo(() => summarizeCustomerOrder(customerOrder), [customerOrder]);
  const manageClothLive =
    manageFromScan && (cloths.find((item) => item.id === manageFromScan.id) ?? manageFromScan);

  useEffect(() => {
    basketIdsRef.current = basketIds;
  }, [basketIds]);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (step !== 'scanning') return;

    let cancelled = false;
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ];
    const scanner = new Html5Qrcode('barcode-reader', { formatsToSupport, verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        (decodedText) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          void handleScanRef.current(decodedText).finally(() => {
            scanLockRef.current = false;
          });
        },
        () => undefined,
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : '';
        setScanError(
          detail.includes('NotAllowed') || detail.includes('Permission')
            ? 'Camera blocked. Allow camera access in app settings, then try again.'
            : 'Could not open camera. Check permissions or try again.',
        );
        setStep('idle');
      });

    return () => {
      cancelled = true;
      if (scanner.isScanning) {
        scanner.stop().catch(() => undefined);
      }
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
    };
  }, [step]);

  async function startScanner() {
    setScanError(null);
    setActionError(null);
    scanLockRef.current = false;

    const access = await ensureCameraAccess();
    if (!access.granted) {
      setScanError(access.message ?? 'Camera permission is required.');
      return;
    }

    setStep('scanning');
  }

  async function stopScanner() {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    scannerRef.current = null;
  }

  async function cancelScanning() {
    await stopScanner();
    setStep('idle');
  }

  async function handleScan(code: string) {
    setBusy(true);
    setActionError(null);
    setScanError(null);
    setManualCode('');

    const normalized = normalizeScannerBarcode(code);

    try {
      const customerKey =
        customerBillLookupCode(normalized) ??
        (looksLikeOrderCode(normalized) ? normalized : null);
      if (customerKey) {
        let incoming = await listClothsByOrderCode(customerKey);
        if (incoming.length === 0) {
          const cloth = await getClothByCode(customerKey);
          if (cloth) incoming = getCustomerOrderCloths(cloth, cloths);
        }
        if (incoming.length === 0) {
          const message = `No customer bill found for "${normalized}"`;
          showToast(message);
          setScanError(message);
          refocusScannerCapture();
          return;
        }
        sessionKindRef.current = null;
        setBasketIds([]);
        setActivePieceId(null);
        setCustomerOrderIds(incoming.map((item) => item.id));
        setStep('customer');
        showToast(`Customer bill · ${incoming[0]?.orderCode || customerKey}`);
        refocusScannerCapture();
        return;
      }

      let incoming: Cloth[] = [];
      const cloth = await getClothByCode(normalized);
      if (!cloth) {
        const message = `No cloth found for code "${normalized}"`;
        showToast(message);
        setScanError(message);
        refocusScannerCapture();
        return;
      }
      incoming = expandScannedCloths(cloth, cloths, normalized);

      const byId = new Map(cloths.map((item) => [item.id, item]));
      const current = basketIdsRef.current
        .map((id) => byId.get(id))
        .filter((item): item is Cloth => Boolean(item));
      const result = applyScanToSession(current, incoming, sessionKindRef.current);

      if (result.mismatched.length > 0 && result.added.length === 0 && result.duplicates.length === 0) {
        const other = classifyScanCloth(result.mismatched[0]!);
        const session = result.sessionKind ?? sessionKindRef.current;
        showToast(session ? otherStageMessage(session, other) : 'Finish this list first.');
        refocusScannerCapture();
        return;
      }

      if (result.added.length === 0 && result.skippedDone.length > 0 && result.duplicates.length === 0) {
        const first = result.skippedDone[0]!;
        showToast(`Already done · ${clothBillName(first)} · ${first.code}`);
        refocusScannerCapture();
        return;
      }

      if (result.added.length === 0 && result.duplicates.length > 0) {
        showToast('Already in list');
        if (result.next.length > 0) setStep('result');
        refocusScannerCapture();
        return;
      }

      if (result.added.length === 0) {
        refocusScannerCapture();
        return;
      }

      sessionKindRef.current = result.sessionKind;
      setBasketIds(result.next.map((item) => item.id));
      const focus = result.added[result.added.length - 1] ?? result.next[0];
      if (focus) {
        setActivePieceId(focus.id);
      }
      setScanError(null);
      setStep('result');
      showToast(scanAddToast(result.added));
      if (result.mismatched.length > 0) {
        const other = classifyScanCloth(result.mismatched[0]!);
        const session = result.sessionKind;
        if (session) showToast(otherStageMessage(session, other));
      }
      refocusScannerCapture();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to look up cloth');
      showToast(err instanceof Error ? err.message : 'Failed to look up cloth');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  useEffect(() => {
    if (!hardwareScanner || !scannerBus) return;
    return scannerBus.subscribe((code) => {
      void handleScanRef.current(code);
    });
  }, [hardwareScanner, scannerBus]);

  useEffect(() => {
    const state = location.state as { scanCode?: string; t?: number } | null;
    if (!state?.scanCode) return;
    void handleScanRef.current(state.scanCode);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  function resetScanner() {
    setActivePieceId(null);
    setManualCode('');
    setScanError(null);
    setActionError(null);
    setBasketIds([]);
    setCustomerOrderIds([]);
    setManageFromScan(null);
    sessionKindRef.current = null;
    setStep('idle');
    refocusScannerCapture();
  }

  function handleBasketChange(next: Cloth[]) {
    setBasketIds(next.map((item) => item.id));
    if (next.length === 0) {
      sessionKindRef.current = null;
      setActivePieceId(null);
      setStep('idle');
      refocusScannerCapture();
      return;
    }
    const focus = next.find((item) => item.id === activePieceId) ?? next[0]!;
    setActivePieceId(focus.id);
  }

  useAndroidBackHandler(() => {
    if (manageFromScan) return;
    if (step === 'scanning') {
      void cancelScanning();
    } else if (step === 'result' || step === 'customer') {
      resetScanner();
    }
  }, !manageFromScan && (step === 'scanning' || step === 'result' || step === 'customer'));

  async function handleManualLookup(event: FormEvent) {
    event.preventDefault();
    const code = normalizeScannerBarcode(manualCode);
    if (!code) return;
    await handleScan(code);
  }

  function handleManualKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isScanTerminatorKey(event.key)) return;
    event.preventDefault();
    const code = normalizeScannerBarcode(manualCode);
    if (code) void handleScan(code);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-5">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-5 pb-6">
      <PageHeader
        title="Home"
        subtitle={
          hardwareScanner
            ? 'Scan a ticket to assign work. Keep scanning to add more of the same stage.'
            : 'Look up a cloth code, then move it to the next stage.'
        }
        action={
          hardwareScanner ? (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                scannerConnected
                  ? 'border-done/40 text-done'
                  : 'border-seam text-ink-muted'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${scannerConnected ? 'bg-done' : 'bg-ink-muted'}`}
              />
              {scannerConnected ? 'Barcode scanner ready' : 'Scanner disconnected'}
            </div>
          ) : null
        }
      />

      {(error || actionError) && (
        <Card className="mb-4 border-overdue/30 bg-white text-sm text-overdue">
          {error ?? actionError}
        </Card>
      )}

      {step === 'idle' && (
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-ink">Today’s work</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {homeStage === 'all' && homeDate
                    ? `${todayBoard.due.length} due · ${todayBoard.done.length} done${
                        todayBoard.overdue.length ? ` · ${todayBoard.overdue.length} overdue` : ''
                      }`
                    : `${getOrderRepresentatives(filteredHomeCloths, cloths).length} orders`}
                </p>
              </div>
            </div>
            <Card className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-[11.5rem]">
                    <Input
                      label="Date"
                      type="date"
                      value={homeDate}
                      onChange={(event) => setHomeDate(event.target.value)}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setHomeDate(todayDateString())}>
                    Today
                  </Button>
                  {homeDate ? (
                    <Button type="button" variant="ghost" onClick={() => setHomeDate('')}>
                      All dates
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {HOME_STAGE_FILTERS.map((item) => {
                    const active = homeStage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setHomeStage(item.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'bg-ink text-white'
                            : 'bg-linen text-ink-muted hover:bg-white hover:text-ink'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4">
                <HomeOrderRows
                  key={`${homeStage}-${homeDate}`}
                  pieces={filteredHomeCloths}
                  allCloths={cloths}
                  empty={
                    homeStage === 'all' && homeDate
                      ? 'Nothing due or done on this date.'
                      : 'No orders match this date or type.'
                  }
                  onOpen={(code) => void handleScan(code)}
                />
              </div>
            </Card>
          </div>

          <Card className="border-action/20 bg-action/5 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-action" />
                <p className="font-display text-sm font-semibold text-ink">
                  {hardwareScanner ? 'Scan or type a ticket' : 'Look up a ticket'}
                </p>
              </div>
            </div>
            <form onSubmit={handleManualLookup} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Cloth code
                </span>
                <input
                  ref={manualInputRef}
                  data-allow-typing
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={handleManualKeyDown}
                  placeholder="e.g. CL-001"
                  autoFocus={!hardwareScanner}
                  className="w-full rounded-[10px] border border-seam bg-white px-4 py-3 font-mono uppercase text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20"
                />
              </label>
              <Button type="submit" disabled={busy || !manualCode.trim()} className="shrink-0 px-5">
                Look up
              </Button>
            </form>
            {scanError && !cameraScanner && (
              <p className="mt-3 rounded-[10px] border border-overdue/30 bg-white px-3 py-2 text-sm text-overdue">
                {scanError}
              </p>
            )}
            {cloths.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(() => {
                  const seenCodes = new Set<string>();
                  return cloths
                    .filter((c) => c.status !== 'completed')
                    .filter((c) => {
                      if (seenCodes.has(c.code)) return false;
                      seenCodes.add(c.code);
                      return true;
                    })
                    .slice(0, 8)
                    .map((cloth) => (
                      <button
                        key={cloth.code}
                        type="button"
                        onClick={() => handleScan(cloth.code)}
                        className="rounded-md border border-action/30 bg-white px-3 py-1 font-mono text-xs font-semibold text-action transition hover:border-action hover:bg-action/10"
                      >
                        {cloth.code}
                      </button>
                    ));
                })()}
              </div>
            )}
          </Card>

          {cameraScanner && (
            <Card className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] border border-action/20 bg-white text-action">
                <Camera className="h-6 w-6" />
              </div>
              <p className="font-medium text-ink">Phone camera</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">
                Scan a printed ticket if the gun is not connected.
              </p>
              {scanError && (
                <p className="mt-4 rounded-[10px] border border-overdue/30 bg-white px-3 py-2 text-sm text-overdue">
                  {scanError}
                </p>
              )}
              <Button onClick={startScanner} disabled={busy} className="mt-4 w-full max-w-xs">
                <ScanLine className="h-5 w-5" />
                Open camera
              </Button>
            </Card>
          )}

          <div>
            <p className="mb-3 font-display text-sm font-semibold text-ink">Work in the shop</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { id: 'cutting' as const, label: 'Cutting', value: counts.cutting, tone: 'text-cut', fill: 'border-cut/30 bg-cut/10' },
                { id: 'unassigned' as const, label: 'Unassigned', value: counts.unassigned, tone: 'text-ink-muted', fill: 'border-seam bg-slate-50' },
                { id: 'tailoring' as const, label: 'Tailoring', value: counts.tailoring, tone: 'text-sew', fill: 'border-sew/30 bg-sew/10' },
                { id: 'done' as const, label: 'Done', value: counts.done, tone: 'text-done', fill: 'border-done/30 bg-done/10' },
              ]).map((item) => {
                const active = homeStage === item.id;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      if (active) {
                        setHomeStage('all');
                        setHomeDate(todayDateString());
                        return;
                      }
                      setHomeStage(item.id);
                      setHomeDate('');
                    }}
                    className={`rounded-[12px] border px-3 py-4 text-center shadow-sm transition ${item.fill} ${
                      active ? 'ring-2 ring-ink/15' : ''
                    }`}
                  >
                    <p className={`font-display text-3xl font-semibold tabular ${item.tone}`}>{item.value}</p>
                    <p className={`mt-1 text-xs font-semibold ${item.tone}`}>{item.label}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[12px] border border-seam bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Staff</p>
              <ul className="mt-3 divide-y divide-seam">
                {staffLoads.rows.map((row) => (
                  <li key={`${row.stage}-${row.staffId}`} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                      <p className={`text-xs font-medium ${row.stage === 'Cutting' ? 'text-cut' : 'text-sew'}`}>
                        {row.stage}
                      </p>
                    </div>
                    <p className={`font-display text-lg font-semibold tabular ${row.stage === 'Cutting' ? 'text-cut' : 'text-sew'}`}>
                      {row.count}
                    </p>
                  </li>
                ))}
                {staffLoads.unassignedCutting > 0 ? (
                  <li className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">Unassigned</p>
                      <p className="text-xs font-medium text-cut">Cutting</p>
                    </div>
                    <p className="font-display text-lg font-semibold tabular text-cut">{staffLoads.unassignedCutting}</p>
                  </li>
                ) : null}
                <li className="flex items-center justify-between gap-3 py-2 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Ready for tailor</p>
                    <p className="text-xs font-medium text-ready">Waiting</p>
                  </div>
                  <p className="font-display text-lg font-semibold tabular text-ready">{staffLoads.ready}</p>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-3 font-display text-sm font-semibold text-ink">Money</p>
            <PaymentDashboard cloths={cloths} />
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <Card className="overflow-hidden p-0">
          <div id="barcode-reader" className="w-full" />
          <div className="p-4">
            <p className="mb-3 text-center text-sm text-slate-500">Point camera at the barcode label</p>
            <Button variant="secondary" onClick={() => void cancelScanning()} className="w-full">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={step === 'customer' && customerOrder.length > 0 && !manageFromScan}
        title={`Customer bill · ${customerBill.orderCode || customerOrder[0]?.code || ''}`}
        size="lg"
        onClose={resetScanner}
      >
        <div className="space-y-4">
          <div>
            <p className="font-display text-lg font-semibold text-ink">{customerBill.customerName}</p>
            <p className="text-sm text-ink-muted">
              {customerBill.pieceCount} {customerBill.pieceCount === 1 ? 'cloth' : 'cloths'}
              {customerBill.givenDate ? ` · Order ${formatCalendarDate(customerBill.givenDate)}` : ''}
              {customerBill.deliveryDate ? ` · Delivery ${formatCalendarDate(customerBill.deliveryDate)}` : ''}
            </p>
          </div>
          <div className="space-y-2 border-t border-seam pt-3">
            {groupClothsForCustomerBill(customerOrder).map((item, index) => (
              <p key={`${item.name}-${index}`} className="text-sm font-semibold text-ink">
                <span className="me-1.5 text-ink-muted">{index + 1}.</span>
                {customerBillItemLabel(item)}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-[14px] border border-seam bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Total</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-ink">
                {formatCurrency(customerBill.totalBill - customerBill.totalDiscount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Advance paid</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-done">
                {formatCurrency(customerBill.totalAdvance)}
              </p>
            </div>
            {customerBill.totalPart > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Part paid</p>
                <p className="mt-1 font-display text-xl font-bold tabular text-done">
                  {formatCurrency(customerBill.totalPart)}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Balance</p>
              <p className="mt-1 font-display text-xl font-bold tabular text-cut">
                {formatCurrency(customerBill.totalPending)}
              </p>
            </div>
          </div>
          {customerBill.notes ? (
            <p className="text-sm text-ink-muted">
              <strong className="text-ink">Note:</strong> {customerBill.notes}
            </p>
          ) : null}
          <Button
            className="w-full rounded-full py-3"
            onClick={() => setManageFromScan(customerOrder[0] ?? null)}
          >
            Manage payment
          </Button>
          <Button variant="secondary" className="w-full rounded-full py-3" onClick={resetScanner}>
            Done
          </Button>
        </div>
      </Modal>

      {manageClothLive ? (
        <ClothManageSheet
          cloth={manageClothLive}
          orderCloths={customerOrder.length > 0 ? customerOrder : getCustomerOrderCloths(manageClothLive, cloths)}
          allCloths={cloths}
          staff={staff}
          onClose={() => setManageFromScan(null)}
          onUpdated={() => void refetch()}
          onShowBarcode={() => setManageFromScan(null)}
        />
      ) : null}

      <Modal
        open={step === 'result' && basket.length > 0}
        title={sessionModalTitle(sessionKindRef.current, basket.length, basket[0]?.code)}
        size="lg"
        onClose={resetScanner}
      >
        <div className="space-y-4">
          <ScanBasketPanel
            basket={basket}
            cutters={cutters}
            tailors={tailors}
            busy={busy}
            onBusy={setBusy}
            onBasketChange={handleBasketChange}
            onUpdated={() => refetch()}
            onClear={resetScanner}
            embedded
          />
          <Button variant="secondary" onClick={resetScanner} className="w-full">
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}

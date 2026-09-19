import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, Hash, ScanBarcode, ScanLine, UserPlus } from 'lucide-react';
import { ensureCameraAccess } from '../lib/camera-permissions';
import {
  assignCutter,
  assignTailor,
  getClothByCode,
  getStaffById,
  getStaffByType,
  markCuttingComplete,
  markSewingComplete,
} from '../lib/data';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAppData } from '../hooks/useAppData';
import { useHardwareScannerBusOptional, refocusScannerCapture } from '../contexts/HardwareScannerContext';
import { supportsCameraScanner, supportsHardwareScanner } from '../lib/platform';
import { isScanTerminatorKey, normalizeScannerBarcode, SUPPORTED_SCANNER } from '../lib/scanner-input';
import { PaymentDashboard, PaymentSummary } from '../components/PaymentDashboard';
import {
  CLOTH_STATUS_COLORS,
  CLOTH_STATUS_LABELS,
  type Cloth,
} from '../types';
import { Badge, Button, Card, Input, Modal, PageHeader, Select } from '../components/ui';
import { formatCalendarDate, isPastDue, todayDateString, clothDescription, clothBillName } from '../lib/utils';
import { getCustomerOrderCloths } from '../lib/customer-order';

type ScanStep = 'idle' | 'scanning' | 'result';

export function ScannerPage() {
  const { cloths, staff, loading, error, refetch } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [step, setStep] = useState<ScanStep>('idle');
  const [scannedCloth, setScannedCloth] = useState<Cloth | null>(null);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [selectedCutterId, setSelectedCutterId] = useState('');
  const [selectedTailorId, setSelectedTailorId] = useState('');
  const [cutterExpectedDate, setCutterExpectedDate] = useState('');
  const [tailorExpectedDate, setTailorExpectedDate] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  const hardwareScanner = supportsHardwareScanner();
  const cameraScanner = supportsCameraScanner();
  const scannerBus = useHardwareScannerBusOptional();
  const lastScan = scannerBus?.lastScan ?? null;
  const lastScanAt = scannerBus?.lastScanAt ?? null;

  const tailors = getStaffByType(staff, 'tailor');
  const cutters = getStaffByType(staff, 'cutter');
  const counts = {
    cutting: cloths.filter((c) => c.status === 'cutting').length,
    ready: cloths.filter((c) => c.status === 'ready_to_sew').length,
    sewing: cloths.filter((c) => c.status === 'sewing').length,
  };

  const scanLockRef = useRef(false);

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
          void handleScan(decodedText).finally(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start only when entering scan mode
  }, [step]);

  async function startScanner() {
    setScanError(null);
    setActionError(null);
    setScannedCloth(null);
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
    await stopScanner();
    setBusy(true);
    setActionError(null);
    setScanError(null);
    setManualCode('');

    const normalized = normalizeScannerBarcode(code);

    try {
      const cloth = await getClothByCode(normalized);

      if (!cloth) {
        setScanError(`No cloth found for code "${normalized}"`);
        setStep('idle');
        return;
      }

      setScannedCloth(cloth);
      setActivePieceId(cloth.id);
      setSelectedCutterId(cloth.cutterId ?? '');
      setSelectedTailorId(cloth.tailorId ?? '');
      setCutterExpectedDate(cloth.cutterExpectedDate ?? '');
      setTailorExpectedDate(cloth.tailorExpectedDate ?? '');
      setStep('result');
      refocusScannerCapture();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to look up cloth');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }

  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;

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
    setScannedCloth(null);
    setActivePieceId(null);
    setSelectedCutterId('');
    setSelectedTailorId('');
    setCutterExpectedDate('');
    setTailorExpectedDate('');
    setManualCode('');
    setScanError(null);
    setActionError(null);
    setStep('idle');
    refocusScannerCapture();
  }

  useAndroidBackHandler(() => {
    if (step === 'scanning') {
      void cancelScanning();
    } else if (step === 'result') {
      resetScanner();
    }
  }, step === 'scanning' || step === 'result');

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

  async function handleSaveStaff() {
    if (!activePiece) return;
    if (!selectedCutterId) {
      setActionError('Choose a cutter first.');
      return;
    }
    setBusy(true);
    setActionError(null);

    try {
      await assignCutter(
        activePiece.id,
        selectedCutterId || null,
        cutterExpectedDate.trim() || null,
      );
      const updated = await assignTailor(
        activePiece.id,
        selectedTailorId || null,
        tailorExpectedDate.trim() || null,
        { startSewing: false },
      );
      if (!updated) return;
      setScannedCloth(updated);
      setActivePieceId(updated.id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign staff');
    } finally {
      setBusy(false);
      refocusScannerCapture();
    }
  }

  async function handleCuttingDone() {
    if (!activePiece) return;
    const cutterId = selectedCutterId || activePiece.cutterId;
    if (!cutterId) {
      setActionError('Assign a cutter first, then mark cutting complete.');
      return;
    }
    setBusy(true);
    setActionError(null);

    try {
      await assignCutter(
        activePiece.id,
        cutterId,
        cutterExpectedDate.trim() || null,
      );
      await assignTailor(
        activePiece.id,
        selectedTailorId || null,
        tailorExpectedDate.trim() || null,
        { startSewing: false },
      );
      const updated = await markCuttingComplete(activePiece.id);
      if (!updated) return;
      const nextId = scannedOrderCloths.find(
        (piece) => piece.id !== activePiece.id && piece.status !== 'completed',
      )?.id;
      setScannedCloth(updated);
      setActivePieceId(nextId ?? updated.id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update cloth');
    } finally {
      setBusy(false);
      refocusScannerCapture();
    }
  }

  async function handleAssignTailor() {
    if (!activePiece || !selectedTailorId || !tailorExpectedDate.trim()) return;
    setBusy(true);
    setActionError(null);

    try {
      const updated = await assignTailor(
        activePiece.id,
        selectedTailorId,
        tailorExpectedDate.trim(),
      );
      if (!updated) return;
      setScannedCloth(updated);
      setActivePieceId(updated.id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign tailor');
    } finally {
      setBusy(false);
      refocusScannerCapture();
    }
  }

  async function handleSewingDone() {
    if (!activePiece) return;
    setBusy(true);
    setActionError(null);

    try {
      const updated = await markSewingComplete(activePiece.id);
      if (!updated) return;
      const nextId = scannedOrderCloths.find(
        (piece) => piece.id !== activePiece.id && piece.status !== 'completed',
      )?.id;
      setScannedCloth(updated);
      setActivePieceId(nextId ?? updated.id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete cloth');
    } finally {
      setBusy(false);
      refocusScannerCapture();
    }
  }

  const scannedOrderCloths = scannedCloth ? getCustomerOrderCloths(scannedCloth, cloths) : [];
  const activePiece =
    scannedOrderCloths.find((piece) => piece.id === activePieceId) ?? scannedCloth;

  const cutter = activePiece ? getStaffById(staff, activePiece.cutterId) : null;
  const tailor = activePiece ? getStaffById(staff, activePiece.tailorId) : null;

  useEffect(() => {
    if (!activePiece) return;
    setSelectedCutterId(activePiece.cutterId ?? '');
    setSelectedTailorId(activePiece.tailorId ?? '');
    setCutterExpectedDate(activePiece.cutterExpectedDate ?? '');
    setTailorExpectedDate(activePiece.tailorExpectedDate ?? '');
  }, [activePiece?.id]);

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
        title="Dashboard"
        subtitle={
          hardwareScanner
            ? 'Scan with USB barcode scanner or enter cloth code'
            : 'Scan barcode to update cloth status'
        }
      />

      {(error || actionError) && (
        <Card className="mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error ?? actionError}
        </Card>
      )}

      <PaymentDashboard cloths={cloths} />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow</p>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Cutting', value: counts.cutting, color: 'bg-amber-50 text-amber-700' },
          { label: 'Ready for Tailor', value: counts.ready, color: 'bg-sky-50 text-sky-700' },
          { label: 'Sewing', value: counts.sewing, color: 'bg-violet-50 text-violet-700' },
        ].map((item) => (
          <Card key={item.label} className={`py-3 text-center ${item.color}`}>
            <p className="text-xl font-bold">{item.value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{item.label}</p>
          </Card>
        ))}
      </div>

      {step === 'idle' && (
        <div className="space-y-4">
          {hardwareScanner && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <div className="flex flex-col items-center py-6 text-center sm:flex-row sm:items-start sm:text-left">
                <div className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 sm:mb-0 sm:mr-5">
                  <ScanBarcode className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {SUPPORTED_SCANNER.model} ready
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Plug in the USB dongle, keep this page open, then scan a{' '}
                    <strong>printed staff ticket</strong>. Each cloth has its own barcode — the popup
                    tracks that item only.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {SUPPORTED_SCANNER.type} · USB dongle · Tickets print as CODE128 on the TVS RP
                    3200 LITE (80mm). Laser reads the paper, not the screen.
                  </p>
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Last scan received
                    </p>
                    {lastScan ? (
                      <p className="font-mono text-sm font-bold text-indigo-700">
                        {lastScan}
                        {lastScanAt ? (
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {new Date(lastScanAt).toLocaleTimeString()}
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        None yet — test by scanning the barcode on your scanner (
                        <span className="font-mono">BG90040267</span>). If it appears here, the
                        dongle works.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {cameraScanner && (
            <Card className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <Camera className="h-8 w-8" />
              </div>
              <p className="font-medium text-slate-800">Camera scanner</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Use the phone camera to scan barcode labels
              </p>
              {scanError && (
                <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{scanError}</p>
              )}
              <Button
                onClick={startScanner}
                disabled={busy}
                className="mt-6 w-full max-w-xs rounded-full py-3.5"
              >
                <ScanLine className="h-5 w-5" />
                Open Camera Scanner
              </Button>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <Hash className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-semibold">
                {hardwareScanner ? 'Scan or type cloth code' : 'Enter cloth code manually'}
              </p>
            </div>
            <form onSubmit={handleManualLookup} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Cloth code</span>
                <input
                  ref={manualInputRef}
                  data-allow-typing
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={handleManualKeyDown}
                  placeholder="e.g. CL-001"
                  autoFocus={!hardwareScanner}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono uppercase text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <Button type="submit" disabled={busy || !manualCode.trim()} className="shrink-0 rounded-xl px-4">
                Look up
              </Button>
            </form>
            {scanError && !cameraScanner && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{scanError}</p>
            )}
            {cloths.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const seenCodes = new Set<string>();
                  return cloths
                    .filter((c) => c.status !== 'completed')
                    .filter((c) => {
                      if (seenCodes.has(c.code)) return false;
                      seenCodes.add(c.code);
                      return true;
                    })
                    .slice(0, 6)
                    .map((cloth) => (
                      <button
                        key={cloth.code}
                        type="button"
                        onClick={() => handleScan(cloth.code)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs font-semibold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
                      >
                        {cloth.code}
                      </button>
                    ));
                })()}
              </div>
            )}
          </Card>
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
        open={step === 'result' && !!scannedCloth && !!activePiece}
        title={activePiece ? `Order ${activePiece.code}` : 'Scan Result'}
        onClose={resetScanner}
      >
        {activePiece && (
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-lg font-bold text-indigo-600">{activePiece.code}</p>
                <p className="font-semibold text-slate-900">{activePiece.customerName}</p>
                {scannedOrderCloths.length > 1 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      This scan is for {clothBillName(activePiece)} · {activePiece.code}. Tap another piece to track it, or scan its own staff ticket.
                    </p>
                    {scannedOrderCloths.map((piece) => (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => setActivePieceId(piece.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          piece.id === activePiece.id
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            {piece.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <span className="inline-block h-4 w-4 shrink-0 rounded border border-slate-300" />
                            )}
                            {clothBillName(piece)}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-indigo-600">{piece.code}</span>
                        </span>
                        <Badge className={`shrink-0 ${CLOTH_STATUS_COLORS[piece.status]}`}>
                          {CLOTH_STATUS_LABELS[piece.status]}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{clothDescription(activePiece)}</p>
                )}
              </div>
              {scannedOrderCloths.length === 1 && (
                <Badge className={`shrink-0 ${CLOTH_STATUS_COLORS[activePiece.status]}`}>
                  {CLOTH_STATUS_LABELS[activePiece.status]}
                </Badge>
              )}
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              {cutter && (
                <p>
                  Cutter: <strong>{cutter.name}</strong>
                </p>
              )}
              {tailor && (
                <p>
                  Tailor: <strong>{tailor.name}</strong>
                </p>
              )}
              {activePiece.notes && <p className="text-slate-400">Note: {activePiece.notes}</p>}
              {(activePiece.givenDate ||
                activePiece.deliveryDate ||
                activePiece.cutterExpectedDate ||
                activePiece.tailorExpectedDate) && (
                <div className="mt-2 space-y-0.5">
                  {activePiece.givenDate && (
                    <p>
                      Order: <strong>{formatCalendarDate(activePiece.givenDate)}</strong>
                    </p>
                  )}
                  {activePiece.deliveryDate && (
                    <p>
                      Delivery: <strong>{formatCalendarDate(activePiece.deliveryDate)}</strong>
                    </p>
                  )}
                  {activePiece.cutterExpectedDate && (
                    <p
                      className={
                        activePiece.status === 'cutting' &&
                        isPastDue(activePiece.cutterExpectedDate, false)
                          ? 'text-rose-600'
                          : ''
                      }
                    >
                      Cutter by:{' '}
                      <strong>{formatCalendarDate(activePiece.cutterExpectedDate)}</strong>
                      {activePiece.status === 'cutting' &&
                        isPastDue(activePiece.cutterExpectedDate, false) &&
                        ' (overdue)'}
                    </p>
                  )}
                  {activePiece.tailorExpectedDate && (
                    <p
                      className={
                        activePiece.status === 'sewing' &&
                        isPastDue(activePiece.tailorExpectedDate, false)
                          ? 'text-rose-600'
                          : ''
                      }
                    >
                      Tailor by:{' '}
                      <strong>{formatCalendarDate(activePiece.tailorExpectedDate)}</strong>
                      {activePiece.status === 'sewing' &&
                        isPastDue(activePiece.tailorExpectedDate, false) &&
                        ' (overdue)'}
                    </p>
                  )}
                </div>
              )}
            </div>
            {activePiece.totalAmount > 0 && (
              <div className="mt-3">
                <PaymentSummary cloth={activePiece} />
              </div>
            )}
          </Card>

          {actionError && (
            <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">
              {actionError}
            </Card>
          )}

          {activePiece.status === 'cutting' && !activePiece.cutterId && (
            <Card className="border-amber-200 bg-amber-50/50">
              <p className="mb-3 text-sm text-slate-700">
                This cloth has no cutter yet. Assign a cutter first.
              </p>
              {cutters.length === 0 ? (
                <p className="text-sm text-rose-600">Add a cutter in Staff first.</p>
              ) : (
                <>
                  <Select
                    label="Select Cutter"
                    value={selectedCutterId}
                    onChange={(e) => setSelectedCutterId(e.target.value)}
                  >
                    <option value="">Choose cutter</option>
                    {cutters.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Cutter Expected Date"
                    type="date"
                    value={cutterExpectedDate}
                    onChange={(e) => setCutterExpectedDate(e.target.value)}
                    min={todayDateString()}
                  />
                  {tailors.length > 0 && (
                    <>
                      <Select
                        label="Select Tailor (optional)"
                        value={selectedTailorId}
                        onChange={(e) => setSelectedTailorId(e.target.value)}
                      >
                        <option value="">Assign later</option>
                        {tailors.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Tailor Expected Date"
                        type="date"
                        value={tailorExpectedDate}
                        onChange={(e) => setTailorExpectedDate(e.target.value)}
                        min={todayDateString()}
                      />
                    </>
                  )}
                  <Button
                    onClick={() => void handleSaveStaff()}
                    disabled={!selectedCutterId || busy}
                    className="mt-4 w-full rounded-full py-3.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    {busy ? 'Saving...' : 'Assign Cutter'}
                  </Button>
                </>
              )}
            </Card>
          )}

          {activePiece.status === 'cutting' && Boolean(activePiece.cutterId) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <p className="mb-3 text-sm text-slate-700">
                Cutter finished? Mark cutting complete
                {cutter ? ` for ${cutter.name}` : ''}.
              </p>
              {tailors.length > 0 && !activePiece.tailorId && (
                <div className="mb-4 space-y-3">
                  <Select
                    label="Select Tailor (optional)"
                    value={selectedTailorId}
                    onChange={(e) => setSelectedTailorId(e.target.value)}
                  >
                    <option value="">Assign later</option>
                    {tailors.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Tailor Expected Date"
                    type="date"
                    value={tailorExpectedDate}
                    onChange={(e) => setTailorExpectedDate(e.target.value)}
                    min={todayDateString()}
                  />
                </div>
              )}
              <Button
                onClick={() => void handleCuttingDone()}
                disabled={busy}
                className="w-full rounded-full py-3.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy ? 'Saving...' : 'Mark Cutting Complete'}
              </Button>
            </Card>
          )}

          {activePiece.status === 'ready_to_sew' && (
            <Card className="border-sky-200 bg-sky-50/50">
              <p className="mb-3 text-sm text-slate-700">Assign this cloth to a tailor for sewing.</p>
              {tailors.length === 0 ? (
                <p className="text-sm text-rose-600">Add a tailor in Staff first.</p>
              ) : (
                <>
                  <Select
                    label="Select Tailor"
                    value={selectedTailorId}
                    onChange={(e) => setSelectedTailorId(e.target.value)}
                  >
                    <option value="">Choose tailor</option>
                    {tailors.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Tailor Expected Date"
                    type="date"
                    value={tailorExpectedDate}
                    onChange={(e) => setTailorExpectedDate(e.target.value)}
                    min={todayDateString()}
                    required
                  />
                  <Button
                    onClick={handleAssignTailor}
                    disabled={!selectedTailorId || !tailorExpectedDate.trim() || busy}
                    className="mt-4 w-full rounded-full py-3.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    {busy ? 'Saving...' : 'Assign to Tailor'}
                  </Button>
                </>
              )}
            </Card>
          )}

          {activePiece.status === 'sewing' && (
            <Card className="border-violet-200 bg-violet-50/50">
              <p className="mb-3 text-sm text-slate-700">
                Tailor finished sewing? Mark this cloth as completed.
              </p>
              <Button
                onClick={handleSewingDone}
                disabled={busy}
                className="w-full rounded-full py-3.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy ? 'Saving...' : 'Mark Sewing Complete'}
              </Button>
            </Card>
          )}

          {activePiece.status === 'completed' && (
            <Card className="border-emerald-200 bg-emerald-50 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-emerald-800">This cloth is already completed!</p>
            </Card>
          )}

          <Button variant="secondary" onClick={resetScanner} className="w-full">
            Scan Another
          </Button>
        </div>
        )}
      </Modal>
    </div>
  );
}

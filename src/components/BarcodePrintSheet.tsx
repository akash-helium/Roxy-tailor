import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, Share2, X, Check } from 'lucide-react';
import type { Cloth, Staff } from '../types';
import { getStaffById } from '../lib/data';
import { generateBarcodeDataUrl, generateOnScreenBarcodeDataUrl } from '../lib/barcode';
import { buildBarcodeCardHtml } from '../lib/barcode-card-html';
import { exportBarcodeForNative, isNativeApp } from '../lib/barcode-export';
import { printBillHtml } from '../lib/bill-export';
import { canPrintThermal, printThermalTicket } from '../lib/thermal-print';
import { clothBarcodeLabel, formatCalendarDate, IN_GROUP_TICKET_LABEL, staffClothParts } from '../lib/utils';
import { buildStaffTicketLines } from '../lib/print-ticket';
import { getLogoDataUrl } from '../lib/logo';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { groupClothsForStaffTickets, staffTicketTitle, summarizeCustomerOrder } from '../lib/customer-order';
import { Button } from './ui';
import { BrandLogo } from './BrandLogo';

function downloadInBrowser(dataUrl: string, code: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function BarcodePrintSheet({
  cloth,
  cloths,
  staff,
  onClose,
}: {
  cloth?: Cloth;
  cloths?: Cloth[];
  staff: Staff[];
  onClose: () => void;
}) {
  const list: Cloth[] = useMemo(() => {
    if (cloths && cloths.length > 0) return cloths;
    return cloth ? [cloth] : [];
  }, [cloth, cloths]);
  const groups = useMemo(() => groupClothsForStaffTickets(list), [list]);
  const [itemIndex, setItemIndex] = useState(0);
  const currentGroup = groups[Math.min(itemIndex, Math.max(groups.length - 1, 0))] ?? [];
  const current = currentGroup[0] ?? null;
  const ticketPieces = currentGroup;
  const summary = useMemo(() => summarizeCustomerOrder(ticketPieces), [ticketPieces]);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [screenBarcodeUrl, setScreenBarcodeUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const native = isNativeApp();
  const listKey = groups.map((group) => group.map((piece) => piece.id).join(',')).join('|');

  useAndroidBackHandler(onClose);

  useEffect(() => {
    setItemIndex(0);
  }, [listKey]);

  const cutter = current ? getStaffById(staff, current.cutterId) : null;
  const tailor = current ? getStaffById(staff, current.tailorId) : null;
  const barcodeValue = current?.code?.trim() || 'UNKNOWN';
  const ticketTitle = staffTicketTitle(ticketPieces);
  const ticketSize = current ? staffClothParts(current).size : '';

  const cardHtml = useMemo(() => {
    if (!barcodeUrl || ticketPieces.length === 0) return null;
    return buildBarcodeCardHtml(ticketPieces, barcodeUrl, barcodeValue, { cutter, tailor, logoDataUrl });
  }, [barcodeUrl, ticketPieces, barcodeValue, cutter, tailor, logoDataUrl]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    let cancelled = false;
    Promise.all([
      generateBarcodeDataUrl(barcodeValue),
      generateOnScreenBarcodeDataUrl(barcodeValue),
    ])
      .then(([printUrl, screenUrl]) => {
        if (!cancelled) {
          setBarcodeUrl(printUrl);
          setScreenBarcodeUrl(screenUrl);
          setError(null);
          setStatus(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not generate barcode');
      });
    void getLogoDataUrl().then((url) => {
      if (!cancelled) setLogoDataUrl(url);
    });
    return () => {
      cancelled = true;
      document.body.style.overflow = '';
    };
  }, [barcodeValue]);

  async function runNative(action: 'print' | 'save' | 'share') {
    if (!barcodeUrl || !current) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await exportBarcodeForNative(barcodeUrl, current, action, {
        garmentLines: [staffTicketTitle(ticketPieces) || clothBarcodeLabel(current)],
        cardHtml: cardHtml ?? undefined,
      });
      setStatus(result.message);
    } catch (err) {
      if (action === 'save') {
        setError('Save failed. Tap Share barcode and choose Save to Files.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not export barcode. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    if (!barcodeUrl || !current || !cardHtml) return;
    if (native) {
      await runNative('print');
      return;
    }
    if (canPrintThermal()) {
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const result = await printThermalTicket({
          barcodeValue,
          lines: buildStaffTicketLines(ticketPieces, { cutter, tailor }),
        });
        if (result.ok) {
          setStatus(result.message);
          return;
        }
        setStatus(`${result.message}. Opening Windows print…`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Thermal print failed');
      } finally {
        setBusy(false);
      }
    }
    printBillHtml(cardHtml, barcodeValue);
    setStatus((prev) => prev ?? 'Printed');
  }

  async function handlePrintAll() {
    if (groups.length === 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (canPrintThermal()) {
        for (let index = 0; index < groups.length; index += 1) {
          const group = groups[index]!;
          const piece = group[0]!;
          setItemIndex(index);
          const result = await printThermalTicket({
            barcodeValue: piece.code,
            lines: buildStaffTicketLines(group, {
              cutter: getStaffById(staff, piece.cutterId),
              tailor: getStaffById(staff, piece.tailorId),
            }),
          });
          if (!result.ok) {
            setStatus(`${result.message}. Stopped at ${piece.code}.`);
            return;
          }
        }
        setStatus(`Printed ${groups.length} staff ticket${groups.length === 1 ? '' : 's'}`);
        return;
      }

      const logo = logoDataUrl || (await getLogoDataUrl());
      const pages: string[] = [];
      let style = '';
      for (const group of groups) {
        const piece = group[0]!;
        const url = await generateBarcodeDataUrl(piece.code);
        const html = buildBarcodeCardHtml(group, url, piece.code, {
          cutter: getStaffById(staff, piece.cutterId),
          tailor: getStaffById(staff, piece.tailorId),
          logoDataUrl: logo,
        });
        if (!style) {
          style = html.match(/<style>[\s\S]*?<\/style>/i)?.[0] ?? '';
        }
        const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
        pages.push(`<div class="ticket-page">${body}</div>`);
      }
      printBillHtml(
        `<!DOCTYPE html><html><head><meta charset="utf-8"/>${style}<style>.ticket-page{page-break-after:always}.ticket-page:last-child{page-break-after:auto}</style></head><body>${pages.join('')}</body></html>`,
        'staff-tickets',
      );
      setStatus(`Prepared ${groups.length} staff tickets`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print all staff tickets');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!barcodeUrl || !current) return;
    if (native) {
      await runNative('save');
      return;
    }
    if (cardHtml) {
      const blob = new Blob([cardHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Barcode-${barcodeValue}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('Barcode card downloaded');
      return;
    }
    downloadInBrowser(barcodeUrl, barcodeValue);
    setStatus('Download started');
  }

  async function handleShare() {
    if (!barcodeUrl || !current) return;
    if (native) {
      await runNative('share');
      return;
    }
    if (navigator.share) {
      try {
        const res = await fetch(barcodeUrl);
        const blob = await res.blob();
        const file = new File([blob], `${barcodeValue}.png`, { type: 'image/png' });
        await navigator.share({ title: barcodeValue, files: [file] });
      } catch {
        downloadInBrowser(barcodeUrl, barcodeValue);
      }
    } else {
      downloadInBrowser(barcodeUrl, barcodeValue);
    }
  }

  if (!current) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div
        className="flex items-center justify-between border-b border-slate-200 px-4 pb-3"
        style={{ paddingTop: 'max(12px, var(--app-safe-top, 0px))' }}
      >
        <h2 className="font-bold text-slate-900">
          Staff ticket · {barcodeValue}
          {groups.length > 1 && (
            <span className="ml-2 text-xs font-medium text-slate-500">
              {itemIndex + 1} of {groups.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pt-6"
        style={{ paddingBottom: 'max(24px, var(--app-safe-bottom, 0px))' }}
      >
        <div className="w-full max-w-sm rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-6 text-center">
          <BrandLogo size={72} className="mx-auto mb-3 h-[72px] w-[72px] rounded-xl" />
          {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
          {status && <p className="mb-2 text-sm text-emerald-600">{status}</p>}
          {!error && !barcodeUrl && barcodeValue && (
            <p className="animate-pulse text-sm text-slate-500">Generating barcode...</p>
          )}
          {(screenBarcodeUrl || barcodeUrl) && (
            <>
              <img
                src={screenBarcodeUrl ?? barcodeUrl ?? ''}
                alt={`Barcode for ${barcodeValue}`}
                className="mx-auto mb-2 block w-[180px] rounded-xl bg-white p-3 shadow-sm"
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
              <p className="mb-3 px-2 text-[11px] leading-snug text-slate-500">
                QuickScan WL2 is a <strong>laser</strong> — it reads the <strong>printed 80mm ticket</strong>,
                not this screen. Print on the TVS RP 3200 LITE, then hold the scanner 5–15 cm away with
                the red line across the full bars.
              </p>
            </>
          )}
          <p className="text-3xl font-bold tracking-wider text-indigo-700">{barcodeValue}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{summary.customerName}</p>
          <div className="mt-3 w-full space-y-3 text-left">
            <div>
              <p className="text-sm font-semibold text-slate-800">{ticketTitle}</p>
              {ticketSize ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{ticketSize}</p>
              ) : null}
            </div>
          </div>
          {ticketPieces.length > 1 && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Qty {ticketPieces.length} prints as one ticket.
            </p>
          )}
          {cutter && <p className="mt-2 text-xs text-slate-500">Cutter: {cutter.name}</p>}
          {tailor && <p className="text-xs text-slate-500">Tailor: {tailor.name}</p>}
          {current.givenDate && (
            <p className="mt-2 text-xs text-slate-500">Order: {formatCalendarDate(current.givenDate)}</p>
          )}
          {current.deliveryDate && (
            <p className="text-xs text-slate-500">Delivery: {formatCalendarDate(current.deliveryDate)}</p>
          )}
          {current.cutterExpectedDate && (
            <p className="text-xs text-slate-500">
              Cutter by: {formatCalendarDate(current.cutterExpectedDate)}
            </p>
          )}
          {current.tailorExpectedDate && (
            <p className="text-xs text-slate-500">
              Tailor by: {formatCalendarDate(current.tailorExpectedDate)}
            </p>
          )}
          {current.notes?.trim() && (
            <p className="mt-2 text-xs text-slate-500">Notes: {current.notes.trim()}</p>
          )}
          {ticketPieces.some((piece) => piece.inGroup) && (
            <p className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
              <Check className="h-4 w-4 shrink-0 stroke-[3]" aria-hidden="true" />
              {IN_GROUP_TICKET_LABEL}
            </p>
          )}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2">
          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={itemIndex === 0 || busy}
                onClick={() => setItemIndex((value) => Math.max(0, value - 1))}
                className="flex-1 rounded-full py-3"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={itemIndex >= groups.length - 1 || busy}
                onClick={() => setItemIndex((value) => Math.min(groups.length - 1, value + 1))}
                className="flex-1 rounded-full py-3"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            onClick={handlePrint}
            disabled={!barcodeUrl || !cardHtml || busy}
            className="w-full rounded-full py-4"
          >
            <Printer className="h-5 w-5" />
            {busy ? 'Please wait...' : native ? 'Print this ticket (Share menu)' : 'Print this ticket'}
          </Button>
          {groups.length > 1 && (
            <Button
              variant="secondary"
              onClick={() => void handlePrintAll()}
              disabled={busy}
              className="w-full rounded-full py-3.5"
            >
              <Printer className="h-4 w-4" />
              Print all {groups.length} staff tickets
            </Button>
          )}
          <p className="text-center text-xs text-slate-400">
            Same cloth quantity prints as one staff ticket.
          </p>
          <Button
            variant="secondary"
            onClick={() => void handleDownload()}
            disabled={!barcodeUrl || busy}
            className="w-full rounded-full py-3.5"
          >
            <Download className="h-4 w-4" />
            {native ? 'Save barcode card' : 'Download Barcode Card'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleShare}
            disabled={!barcodeUrl || busy}
            className="w-full rounded-full py-3"
          >
            <Share2 className="h-4 w-4" />
            Share barcode
          </Button>
        </div>

        {native && (
          <p className="max-w-xs text-center text-xs text-slate-400">
            Save stores the barcode in the app and opens the share menu — choose{' '}
            <strong>Save to Files</strong> or <strong>Downloads</strong>
          </p>
        )}
        <p className="text-center text-xs text-slate-400">
          Barcode: <span className="font-mono font-semibold">{barcodeValue}</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Printer,
  Receipt,
  ScanBarcode,
  Share2,
  X,
} from "lucide-react";
import type { Cloth } from "../types";
import { generateBarcodeDataUrl, PRINT_BARCODE } from "../lib/barcode";
import { buildCustomerBillHtml, type BillBarcode } from "../lib/bill-html";
import { summarizeCustomerOrder, groupClothsForCustomerBill, customerBillItemLabel } from "../lib/customer-order";
import { formatCurrency } from "../lib/payments";
import {
  exportBillForNative,
  isNativeApp,
  printBillHtml,
  downloadBillHtml,
} from "../lib/bill-export";
import { canPrintThermal, printThermalTicket } from "../lib/thermal-print";
import { formatCalendarDate } from "../lib/utils";
import {
  formatPrintDateTime,
  buildCustomerBillTicketLines,
} from "../lib/print-ticket";
import { useAndroidBackHandler } from "../hooks/useAndroidBackHandler";
import { APP_NAME, BILL_POLICY_NOTE } from "../lib/app-config";
import { getLogoDataUrl } from "../lib/logo";
import { Button } from "./ui";
import { BrandLogo } from "./BrandLogo";

export function CustomerBillPrintSheet({
  cloths,
  onClose,
  onPrintBarcodes,
}: {
  cloths: Cloth[];
  onClose: () => void;
  onPrintBarcodes?: () => void;
}) {
  const sorted = useMemo(
    () => [...cloths].sort((a, b) => a.code.localeCompare(b.code)),
    [cloths],
  );
  const summary = useMemo(() => summarizeCustomerOrder(sorted), [sorted]);
  const [barcodes, setBarcodes] = useState<BillBarcode[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const printingRef = useRef(false);
  const native = isNativeApp();

  useAndroidBackHandler(onClose);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    setLoading(true);
    setError(null);
    const orderCode = sorted[0]?.code?.trim();
    if (!orderCode) {
      setBarcodes([]);
      setLoading(false);
      return;
    }

    generateBarcodeDataUrl(orderCode, {
      height: PRINT_BARCODE.height,
      moduleWidth: PRINT_BARCODE.moduleWidth,
      maxWidth: PRINT_BARCODE.maxWidth,
      displayValue: false,
    })
      .then((dataUrl) => setBarcodes([{ code: orderCode, dataUrl }]))
      .catch(() => setError("Could not generate barcode for bill"))
      .finally(() => setLoading(false));

    void getLogoDataUrl().then(setLogoDataUrl);

    return () => {
      document.body.style.overflow = "";
    };
  }, [sorted]);

  const printBillHtmlDoc = useMemo(() => {
    if (barcodes.length === 0) return null;
    return buildCustomerBillHtml(sorted, barcodes, new Date(), logoDataUrl, { copies: 2 });
  }, [sorted, barcodes, logoDataUrl]);

  const billHtml = useMemo(() => {
    if (barcodes.length === 0) return null;
    return buildCustomerBillHtml(sorted, barcodes, new Date(), logoDataUrl);
  }, [sorted, barcodes, logoDataUrl]);

  async function handlePrint() {
    if (!printBillHtmlDoc || printingRef.current) return;
    printingRef.current = true;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      if (native) {
        const result = await exportBillForNative(
          printBillHtmlDoc,
          summary.customerName,
          "print",
        );
        setStatus(result.message);
        return;
      }
      if (canPrintThermal()) {
        const result = await printThermalTicket({
          title: APP_NAME,
          headerImageUrl: logoDataUrl || undefined,
          barcodeValue: summary.codes[0] ?? "Order",
          lines: buildCustomerBillTicketLines(sorted),
          footer: BILL_POLICY_NOTE,
          copies: 2,
        });
        if (result.ok) {
          setStatus("Printed");
          return;
        }
        setStatus(`${result.message}. Opening Windows print…`);
      }
      printBillHtml(printBillHtmlDoc, `Bill ${summary.codes.join(", ")}`);
      setStatus((prev) => prev ?? "Printed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not print bill");
    } finally {
      printingRef.current = false;
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!billHtml) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      if (native) {
        const result = await exportBillForNative(
          billHtml,
          summary.customerName,
          "share",
        );
        setStatus(result.message);
      } else if (navigator.share) {
        const blob = new Blob([billHtml], { type: "text/html" });
        const file = new File([blob], `Bill-${summary.customerName}.html`, {
          type: "text/html",
        });
        await navigator.share({
          title: `Bill · ${summary.customerName}`,
          files: [file],
        });
      } else {
        await handleDownload();
      }
    } catch {
      await handleDownload();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!billHtml) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      if (native) {
        const result = await exportBillForNative(
          billHtml,
          summary.customerName,
          "save",
        );
        setStatus(result.message);
      } else {
        downloadBillHtml(billHtml, summary.customerName);
        setStatus("Bill downloaded");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download bill");
    } finally {
      setBusy(false);
    }
  }

  if (sorted.length === 0) return null;

  const billLabel = summary.codes[0] ?? "Order";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-100">
      <div
        className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(12px, var(--app-safe-top, 0px))" }}
      >
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <Receipt className="h-5 w-5 text-indigo-600" />
          Customer Bill · {billLabel}
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
        className="flex flex-1 flex-col items-center overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: "max(24px, var(--app-safe-bottom, 0px))" }}
      >
        {error && (
          <p className="mb-3 w-full max-w-md rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        {status && (
          <p className="mb-3 w-full max-w-md rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {status}
          </p>
        )}

        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60">
          <div className="border-b-2 border-slate-900 pb-3 text-center">
            <BrandLogo size={96} className="mx-auto mb-2 h-24 w-24" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Customer Bill / Receipt
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Customer
              </p>
              <p className="font-semibold text-slate-900">
                {summary.customerName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Printed
              </p>
              <p className="font-semibold text-slate-900">
                {formatPrintDateTime()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Order Code
              </p>
              <p className="font-mono text-sm font-semibold text-indigo-600">
                {summary.codes[0] ?? "—"}
              </p>
            </div>
            {summary.givenDate ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Order date
                </p>
                <p className="font-semibold text-slate-900">
                  {formatCalendarDate(summary.givenDate)}
                </p>
              </div>
            ) : null}
            {summary.deliveryDate ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Delivery date
                </p>
                <p className="font-semibold text-slate-900">
                  {formatCalendarDate(summary.deliveryDate)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            {groupClothsForCustomerBill(sorted).map((item, i) => (
              <div key={`${item.name}-${i}`} className="text-sm">
                <p>
                  <span className="mr-1.5 font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                  <span className="font-semibold text-slate-800">
                    {customerBillItemLabel(item)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
            <div className="flex justify-between font-bold text-slate-900">
              <span>Total amount</span>
              <span>
                {formatCurrency(summary.totalBill - summary.totalDiscount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Advance</span>
              <span>{formatCurrency(summary.totalAdvance)}</span>
            </div>
            {summary.totalPart > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>Part paid</span>
                <span>{formatCurrency(summary.totalPart)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t-2 border-slate-900 pt-3 text-lg font-black text-slate-900">
              <span>Pending</span>
              <span>{formatCurrency(summary.totalPending)}</span>
            </div>
          </div>

          {summary.notes && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
              <strong>Note:</strong> {summary.notes}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            Thank you for your order — please keep this bill for pickup.
          </p>

          <div className="mt-5 border-t-2 border-dashed border-indigo-200 pt-4">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Scan barcode for tracking
            </p>
            {loading && (
              <p className="animate-pulse text-center text-sm text-slate-400">
                Generating barcodes…
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {barcodes.map((b) => (
                <div key={b.code} className="text-center">
                  <img
                    src={b.dataUrl}
                    alt={`Barcode ${b.code}`}
                    className="mx-auto w-[180px] bg-white"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <p className="font-mono text-xs font-bold text-indigo-700">
                    {b.code}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-center text-[11px] leading-relaxed text-slate-700">
            <p className="whitespace-normal break-words text-center">
              {BILL_POLICY_NOTE}
            </p>
          </div>
        </div>

        <div className="mt-4 flex w-full max-w-md flex-col gap-2">
          <Button
            onClick={handlePrint}
            disabled={!billHtml || busy}
            className="w-full rounded-full py-4"
          >
            <Printer className="h-5 w-5" />
            {busy ? "Please wait…" : "Print Bill"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleDownload()}
            disabled={!billHtml || busy}
            className="w-full rounded-full py-3.5"
          >
            <Download className="h-4 w-4" />
            {native ? "Save Bill" : "Download Bill"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleShare()}
            disabled={!billHtml || busy}
            className="w-full rounded-full py-3"
          >
            <Share2 className="h-4 w-4" />
            Share Bill
          </Button>
          {onPrintBarcodes && (
            <Button
              variant="ghost"
              onClick={onPrintBarcodes}
              className="w-full rounded-full py-3"
            >
              <ScanBarcode className="h-4 w-4" />
              Print barcode for staff
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

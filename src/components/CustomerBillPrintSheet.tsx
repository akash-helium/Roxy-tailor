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
import { customerBillScanCode } from "../lib/scan-basket";
import { buildCustomerBillHtml, type BillBarcode } from "../lib/bill-html";
import {
  summarizeCustomerOrder,
  groupClothsForCustomerBill,
  customerBillSlipName,
  customerBillClothNos,
} from "../lib/customer-order";
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
  buildCustomerBillTicketLines,
  buildCustomerBillAfterBarcodeLines,
} from "../lib/print-ticket";
import { useAndroidBackHandler } from "../hooks/useAndroidBackHandler";
import { APP_NAME, BILL_POLICY_NOTE, SHOP_ADDRESS, SHOP_PHONE } from "../lib/app-config";
import { Button } from "./ui";

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
    const scanCode = customerBillScanCode(
      sorted.find((item) => item.orderCode)?.orderCode?.trim() || "",
      sorted[0]?.code?.trim() || "",
    );
    if (!scanCode) {
      setBarcodes([]);
      setLoading(false);
      return;
    }

    generateBarcodeDataUrl(scanCode, {
      height: PRINT_BARCODE.height,
      moduleWidth: PRINT_BARCODE.moduleWidth,
      maxWidth: PRINT_BARCODE.maxWidth,
      displayValue: false,
    })
      .then((dataUrl) => setBarcodes([{ code: scanCode, dataUrl }]))
      .catch(() => setError("Could not generate barcode for bill"))
      .finally(() => setLoading(false));

    return () => {
      document.body.style.overflow = "";
    };
  }, [sorted]);

  const printBillHtmlDoc = useMemo(() => {
    if (barcodes.length === 0) return null;
    return buildCustomerBillHtml(sorted, barcodes, new Date(), "", { copies: 2 });
  }, [sorted, barcodes]);

  const billHtml = useMemo(() => {
    if (barcodes.length === 0) return null;
    return buildCustomerBillHtml(sorted, barcodes);
  }, [sorted, barcodes]);

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
          barcodeValue: customerBillScanCode(
            summary.orderCode,
            summary.codes[0] || "",
          ),
          lines: buildCustomerBillTicketLines(sorted),
          afterBarcodeLines: buildCustomerBillAfterBarcodeLines(),
          copies: 2,
          bold: false,
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

  const billLabel = summary.orderCode || summary.codes[0] || "Order";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-100">
      <div
        className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(12px, var(--app-safe-top, 0px))" }}
      >
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <Receipt className="h-5 w-5 text-action" />
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

        <div className="w-full max-w-[320px] border border-slate-200 bg-white px-4 py-5 shadow-lg shadow-slate-200/60">
          <p className="text-center text-xl font-semibold uppercase tracking-wide text-ink">
            {APP_NAME}
          </p>
          {SHOP_PHONE ? (
            <p className="mt-1 text-center text-xs font-medium text-ink">
              Contact No - {SHOP_PHONE}
            </p>
          ) : null}

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-ink">Delivery Date</p>
              <p className="text-base font-semibold leading-tight text-ink">
                {summary.deliveryDate ? formatCalendarDate(summary.deliveryDate) : "—"}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-medium text-ink">Order No</p>
              <p className="text-base font-semibold leading-tight text-ink">
                {summary.orderCode || summary.codes[0] || "—"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-lg font-semibold leading-snug text-ink">
            Name - {summary.customerName}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            Contact No - {summary.customerPhone || ""}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            Booking Date - {summary.givenDate ? formatCalendarDate(summary.givenDate) : "—"}
          </p>

          <div className="mt-4 space-y-1.5">
            {groupClothsForCustomerBill(sorted).map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
                <span>
                  {i + 1}. {customerBillSlipName(item)}
                </span>
                <span className="font-mono text-xs">
                  {customerBillClothNos(item)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-ink pt-3 text-sm font-medium text-ink">
            <p className="flex justify-between gap-3">
              <span>Total Amount</span>
              <span>{formatCurrency(summary.totalBill - summary.totalDiscount)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>Advance</span>
              <span>{formatCurrency(summary.totalAdvance)}</span>
            </p>
            {summary.totalPart > 0 ? (
              <p className="flex justify-between gap-3">
                <span>Part paid</span>
                <span>{formatCurrency(summary.totalPart)}</span>
              </p>
            ) : null}
            <p className="flex justify-between gap-3 pt-1 text-xl font-semibold underline decoration-2 underline-offset-2">
              <span>Pending</span>
              <span>{formatCurrency(summary.totalPending)}</span>
            </p>
          </div>

          {summary.notes ? (
            <p className="mt-3 text-sm font-medium text-ink whitespace-pre-wrap">
              Note - {summary.notes}
            </p>
          ) : null}

          <div className="mt-4 text-center">
            {loading && (
              <p className="animate-pulse text-sm text-slate-400">
                Generating barcode…
              </p>
            )}
            {barcodes.map((b) => (
              <div key={b.code}>
                <img
                  src={b.dataUrl}
                  alt={`Barcode ${b.code}`}
                  className="mx-auto h-12 w-[200px] bg-white object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <p className="mt-1 font-mono text-xs font-medium text-ink">{b.code}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm font-medium text-ink">Add- {SHOP_ADDRESS}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-ink">
            {BILL_POLICY_NOTE}
          </p>
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

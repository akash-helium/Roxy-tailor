import { APP_NAME, BILL_POLICY_NOTE } from "./app-config";
import { formatCurrency } from "./payments";
import { formatCalendarDate } from "./utils";
import type { Cloth } from "../types";
import {
  summarizeCustomerOrder,
  groupClothsForCustomerBill,
  customerBillItemLabel,
} from "./customer-order";
import { formatPrintDateTime } from "./print-ticket";

export type BillBarcode = { code: string; dataUrl: string };

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Customer bill HTML — matches on-screen receipt (Windows print + Android share/print). */
export function buildCustomerBillHtml(
  cloths: Cloth[],
  barcodes: BillBarcode[],
  printedAt = new Date(),
  logoDataUrl = "",
  options?: { copies?: number },
) {
  const summary = summarizeCustomerOrder(cloths);
  const orderCode = summary.orderCode || summary.codes[0] || "—";
  const printedLabel = formatPrintDateTime(printedAt);
  const copies = Math.max(1, Math.min(2, options?.copies ?? 1));

  const rows = groupClothsForCustomerBill(cloths)
    .map(
      (item, i) => `
    <div class="item-row">
      <span class="num">${i + 1}.</span>
      <div class="item-body">
        <div class="item-title">${escapeHtml(customerBillItemLabel(item))}</div>
      </div>
    </div>`,
    )
    .join("");

  const primaryBarcode = barcodes[0];
  const barcodeBlock = primaryBarcode
    ? `
    <div class="barcode-block">
      <div class="barcode-label">Scan to open customer bill</div>
      <img src="${primaryBarcode.dataUrl}" alt="Barcode ${escapeHtml(primaryBarcode.code)}" />
      <div class="barcode-code-lg">${escapeHtml(primaryBarcode.code)}</div>
    </div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bill ${escapeHtml(orderCode)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; color: #000; }
  @page { size: 80mm auto; margin: 2mm; }
  html, body { width: 76mm; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #000;
    margin: 0 auto;
    padding: 4mm 2mm 8mm;
    max-width: 76mm;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .logo {
    display: block;
    width: 28mm;
    height: 28mm;
    object-fit: contain;
    margin: 0 auto 4px;
    filter: grayscale(1) contrast(3);
  }
  .shop {
    font-size: 20px;
    font-weight: 900;
    color: #000;
    letter-spacing: -0.02em;
  }
  .tagline {
    font-size: 11px;
    color: #000;
    font-weight: 800;
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  .meta .label {
    color: #000;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .meta .value {
    font-weight: 800;
    color: #000;
    font-size: 15px;
    margin-top: 2px;
  }
  .meta .full { grid-column: 1 / -1; }
  .meta .code-value {
    font-family: ui-monospace, monospace;
    color: #000;
    font-weight: 800;
  }
  .items {
    border-top: 1px solid #000;
    padding-top: 12px;
    margin-bottom: 14px;
  }
  .item-row {
    display: flex;
    gap: 8px;
    padding: 8px 0;
    font-size: 14px;
    color: #000;
    align-items: flex-start;
  }
  .num { color: #000; font-weight: 800; min-width: 1.25rem; }
  .item-body { flex: 1; min-width: 0; }
  .item-title { font-weight: 800; }
  .item-detail {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    font-weight: 700;
    word-break: break-word;
  }
  .totals {
    border-top: 1px dashed #000;
    padding-top: 12px;
    font-size: 15px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    color: #000;
    font-weight: 700;
  }
  .totals .row.total {
    color: #000;
    font-weight: 900;
  }
  .totals .row.pending {
    font-size: 18px;
    font-weight: 900;
    color: #000;
    background: #fff;
    margin-top: 6px;
    padding: 8px 0 4px;
    border-top: 2px solid #000;
  }
  .totals .row.pending span {
    font-weight: 900;
  }
  .notes {
    margin-top: 12px;
    padding: 10px 0;
    font-size: 12px;
    color: #000;
    font-weight: 700;
  }
  .barcodes {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 2px dashed #000;
  }
  .barcode-block { text-align: center; padding: 4px 0; background: #fff; }
  .barcode-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 6px;
  }
  .barcode-block img {
    display: block;
    width: 46mm;
    max-width: 46mm;
    height: 11mm;
    max-height: 11mm;
    object-fit: contain;
    margin: 0 auto;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: grayscale(1) contrast(10);
  }
  .barcode-code-lg {
    font-family: ui-monospace, monospace;
    font-size: 18px;
    font-weight: 900;
    color: #000;
    margin-top: 2px;
    letter-spacing: 0.08em;
  }
  .footer {
    text-align: center;
    margin-top: 14px;
    font-size: 12px;
    color: #000;
    font-weight: 700;
  }
  .policy {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed #000;
    text-align: center;
    font-size: 10px;
    line-height: 1.5;
    color: #000;
    font-weight: 700;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .receipt + .receipt {
    page-break-before: always;
    break-before: page;
    margin-top: 8mm;
    padding-top: 6mm;
  }
  @media print {
    body { padding: 0; max-width: 76mm; color: #000; background: #fff; }
    .receipt + .receipt { margin-top: 0; padding-top: 0; }
  }
</style></head><body>
${Array.from({ length: copies }, () => `  <div class="receipt">
  <div class="header">
    ${
      logoDataUrl
        ? `<img class="logo" src="${logoDataUrl}" alt="${escapeHtml(APP_NAME)}" />`
        : `<div class="shop">${escapeHtml(APP_NAME)}</div>`
    }
    <div class="tagline">Customer Bill / Receipt</div>
  </div>
  <div class="meta">
    <div>
      <div class="label">Customer</div>
      <div class="value">${escapeHtml(summary.customerName)}</div>
    </div>
    <div>
      <div class="label">Printed</div>
      <div class="value">${escapeHtml(printedLabel)}</div>
    </div>
    <div class="full">
      <div class="label">Order Code</div>
      <div class="value code-value">${escapeHtml(orderCode)}</div>
    </div>
    ${summary.givenDate ? `<div><div class="label">Order date</div><div class="value">${escapeHtml(formatCalendarDate(summary.givenDate))}</div></div>` : ""}
    ${summary.deliveryDate ? `<div><div class="label">Delivery date</div><div class="value">${escapeHtml(formatCalendarDate(summary.deliveryDate))}</div></div>` : ""}
  </div>
  <div class="items">${rows}</div>
  <div class="totals">
    <div class="row total"><span>Total amount</span><span>${formatCurrency(summary.totalBill - summary.totalDiscount)}</span></div>
    <div class="row"><span>Advance</span><span>${formatCurrency(summary.totalAdvance)}</span></div>
    ${summary.totalPart > 0 ? `<div class="row"><span>Part paid</span><span>${formatCurrency(summary.totalPart)}</span></div>` : ""}
    <div class="row pending"><span>Pending</span><span>${formatCurrency(summary.totalPending)}</span></div>
  </div>
  ${summary.notes ? `<div class="notes"><strong>Note:</strong> ${escapeHtml(summary.notes)}</div>` : ""}
  <div class="footer">Thank you for your order - please keep this bill for pickup.</div>
  <div class="policy">${escapeHtml(BILL_POLICY_NOTE)}</div>
  <div class="barcodes">
    ${barcodeBlock}
  </div>
  </div>`).join("\n")}
</body></html>`;
}

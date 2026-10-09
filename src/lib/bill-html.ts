import { APP_NAME, BILL_POLICY_NOTE, SHOP_ADDRESS, SHOP_PHONE } from "./app-config";
import { formatCurrency } from "./payments";
import { formatCalendarDate } from "./utils";
import type { Cloth } from "../types";
import {
  summarizeCustomerOrder,
  groupClothsForCustomerBill,
  customerBillSlipName,
  customerBillClothNos,
} from "./customer-order";

export type BillBarcode = { code: string; dataUrl: string };

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Customer bill HTML — handwritten slip layout (Windows print + Android share/print). */
export function buildCustomerBillHtml(
  cloths: Cloth[],
  barcodes: BillBarcode[],
  _printedAt = new Date(),
  _logoDataUrl = "",
  options?: { copies?: number },
) {
  const summary = summarizeCustomerOrder(cloths);
  const orderCode = summary.orderCode || summary.codes[0] || "—";
  const delivery = summary.deliveryDate ? formatCalendarDate(summary.deliveryDate) : "—";
  const booking = summary.givenDate ? formatCalendarDate(summary.givenDate) : "—";
  const copies = Math.max(1, Math.min(2, options?.copies ?? 1));

  const rows = groupClothsForCustomerBill(cloths)
    .map((item, i) => {
      const clothNo = customerBillClothNos(item);
      return `
    <div class="item-row">
      <span class="num">${i + 1}.</span>
      <span class="item-title">${escapeHtml(customerBillSlipName(item))}</span>
      ${clothNo ? `<span class="clno">${escapeHtml(clothNo)}</span>` : ""}
    </div>`;
    })
    .join("");

  const primaryBarcode = barcodes[0];
  const barcodeBlock = primaryBarcode
    ? `
    <div class="barcode-block">
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
    padding: 3mm 2mm 8mm;
    max-width: 76mm;
    background: #fff;
  }
  .shop {
    text-align: center;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0 0 1mm;
  }
  .shop-phone {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    margin: 0 0 3mm;
  }
  .banner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2mm;
    margin-bottom: 3mm;
  }
  .banner .col { min-width: 0; }
  .banner .col.right { text-align: right; }
  .banner .label {
    font-size: 10px;
    font-weight: 500;
  }
  .banner .value {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.15;
    word-break: break-word;
  }
  .field { font-size: 13px; font-weight: 500; margin: 1.2mm 0; }
  .name {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    margin: 2mm 0 1.5mm;
    word-break: break-word;
  }
  .items { margin: 3mm 0 2mm; }
  .divider {
    border: 0;
    border-top: 1px solid #000;
    margin: 1mm 0 2.5mm;
  }
  .item-row {
    display: flex;
    gap: 2mm;
    align-items: baseline;
    font-size: 13px;
    font-weight: 500;
    padding: 1mm 0;
  }
  .num { flex: 0 0 auto; }
  .item-title { flex: 1 1 auto; min-width: 0; }
  .clno {
    flex: 0 1 auto;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    font-weight: 500;
    text-align: right;
  }
  .money {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 3mm;
    font-size: 13px;
    font-weight: 500;
    margin: 1mm 0;
  }
  .pending {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 3mm;
    font-size: 18px;
    font-weight: 700;
    margin: 2mm 0 2mm;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .note {
    font-size: 12px;
    font-weight: 500;
    margin: 1mm 0 2mm;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .policy {
    margin: 2mm 0 0;
    font-size: 9px;
    line-height: 1.4;
    font-weight: 400;
    word-wrap: break-word;
  }
  .barcode-block { text-align: center; padding: 2mm 0; }
  .barcode-block img {
    display: block;
    width: 52mm;
    max-width: 52mm;
    height: 12mm;
    object-fit: contain;
    margin: 0 auto;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .barcode-code-lg {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    font-weight: 500;
    margin-top: 1mm;
    letter-spacing: 0.04em;
  }
  .address {
    margin-top: 3mm;
    font-size: 12px;
    font-weight: 500;
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
  <div class="shop">${escapeHtml(APP_NAME)}</div>
  ${SHOP_PHONE ? `<div class="shop-phone">Contact No - ${escapeHtml(SHOP_PHONE)}</div>` : ""}
  <div class="banner">
    <div class="col">
      <div class="label">Delivery Date</div>
      <div class="value">${escapeHtml(delivery)}</div>
    </div>
    <div class="col right">
      <div class="label">Order No</div>
      <div class="value">${escapeHtml(orderCode)}</div>
    </div>
  </div>
  <div class="name">Name - ${escapeHtml(summary.customerName)}</div>
  ${summary.customerPhone ? `<div class="field">Contact No - ${escapeHtml(summary.customerPhone)}</div>` : `<div class="field">Contact No -</div>`}
  <div class="field">Booking Date - ${escapeHtml(booking)}</div>
  <div class="items">${rows}</div>
  <hr class="divider" />
  <div class="money"><span>Total Amount</span><span>${formatCurrency(summary.totalBill - summary.totalDiscount)}</span></div>
  <div class="money"><span>Advance</span><span>${formatCurrency(summary.totalAdvance)}</span></div>
  ${summary.totalPart > 0 ? `<div class="money"><span>Part paid</span><span>${formatCurrency(summary.totalPart)}</span></div>` : ""}
  <div class="pending"><span>Pending</span><span>${formatCurrency(summary.totalPending)}</span></div>
  ${summary.notes ? `<div class="note">Note - ${escapeHtml(summary.notes)}</div>` : ""}
  ${barcodeBlock}
  <div class="address">Add- ${escapeHtml(SHOP_ADDRESS)}</div>
  <div class="policy">${escapeHtml(BILL_POLICY_NOTE)}</div>
  </div>`).join("\n")}
</body></html>`;
}

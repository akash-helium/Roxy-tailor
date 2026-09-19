import type { Cloth, Staff } from '../types';
import { APP_NAME } from './app-config';
import { PRINT_BARCODE } from './barcode';
import { formatCalendarDate, IN_GROUP_TICKET_LABEL, staffClothParts } from './utils';
import { staffTicketTitle } from './customer-order';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Full staff barcode card: scannable barcode + order/piece data on one page. */
export function buildBarcodeCardHtml(
  cloths: Cloth[],
  barcodeDataUrl: string,
  orderCode: string,
  options?: { cutter?: Staff | null; tailor?: Staff | null; logoDataUrl?: string },
) {
  const primary = cloths[0];
  if (!primary) return '';

  const { size } = staffClothParts(primary);
  const garmentLines = `<div class="item">
      <div class="item-name">${escapeHtml(staffTicketTitle(cloths))}</div>
      ${size ? `<div class="item-size">${escapeHtml(size)}</div>` : ''}
    </div>`;

  const cutter = options?.cutter;
  const tailor = options?.tailor;
  const inGroup = cloths.some((cloth) => cloth.inGroup);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(orderCode)}</title>
<style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
@page{size:80mm auto;margin:2mm}
html,body{width:76mm}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center;padding:4mm 2mm;margin:0;color:#000;font-weight:600;background:#fff}
.logo{display:block;width:18mm;height:18mm;object-fit:contain;margin:0 auto 3mm}
.shop{font-size:14px;font-weight:900;margin:0 0 4mm;letter-spacing:-0.02em}
.barcode-wrap{display:block;padding:1mm 0 2mm;background:#fff}
.barcode-wrap img{display:block;width:${PRINT_BARCODE.cssWidth};max-width:${PRINT_BARCODE.cssWidth};height:${PRINT_BARCODE.cssHeight};max-height:${PRINT_BARCODE.cssHeight};object-fit:contain;object-position:center;margin:0 auto;image-rendering:pixelated;image-rendering:crisp-edges}
.code{font-size:22px;font-weight:900;color:#000;margin:8px 0 6px;letter-spacing:2px;font-family:ui-monospace,monospace}
.customer{color:#000;font-size:15px;font-weight:800;margin:4px 0 10px}
.items{margin:0 0 6px}
.item{color:#000;text-align:left;margin:0 0 8px;padding:0 0 8px;border-bottom:1px dashed #000}
.item:last-child{margin-bottom:0}
.item-name{font-size:13px;font-weight:800;line-height:1.35}
.item-size{margin-top:4px;font-size:11px;font-weight:600;line-height:1.5;white-space:normal;word-break:break-word}
.item-flag{margin-top:8px;padding-top:8px;border-top:1px dashed #000;font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px;text-align:left}
.tick{display:inline-block;width:0.45em;height:0.85em;border-right:0.22em solid #000;border-bottom:0.22em solid #000;transform:rotate(45deg);margin:0 0.15em 0.2em 0.05em;flex-shrink:0}
.meta{color:#000;font-size:12px;font-weight:600;margin:3px 0;text-align:left}
.meta strong{font-weight:800}
.section{margin-top:8px;padding-top:8px;border-top:1px dashed #000}
@media print{
  body{padding:0}
}
</style></head><body>
${options?.logoDataUrl ? `<img class="logo" src="${options.logoDataUrl}" alt="${escapeHtml(APP_NAME)}"/>` : ''}
<div class="shop">${escapeHtml(APP_NAME)}</div>
<div class="barcode-wrap">
  <img src="${barcodeDataUrl}" alt="Barcode ${escapeHtml(orderCode)}"/>
</div>
<div class="code">${escapeHtml(orderCode)}</div>
<div class="customer">${escapeHtml(primary.customerName)}</div>
<div class="items">${garmentLines}</div>
${cloths.length > 1 ? `<div class="meta">Qty ${cloths.length}</div>` : ''}
<div class="section">
${cutter ? `<div class="meta">Cutter: ${escapeHtml(cutter.name)}</div>` : ''}
${tailor ? `<div class="meta">Tailor: ${escapeHtml(tailor.name)}</div>` : ''}
${primary.givenDate ? `<div class="meta">Order: ${escapeHtml(formatCalendarDate(primary.givenDate))}</div>` : ''}
${primary.deliveryDate ? `<div class="meta">Delivery: ${escapeHtml(formatCalendarDate(primary.deliveryDate))}</div>` : ''}
${primary.cutterExpectedDate ? `<div class="meta">Cutter by: ${escapeHtml(formatCalendarDate(primary.cutterExpectedDate))}</div>` : ''}
${primary.tailorExpectedDate ? `<div class="meta">Tailor by: ${escapeHtml(formatCalendarDate(primary.tailorExpectedDate))}</div>` : ''}
${primary.notes?.trim() ? `<div class="meta">Notes: ${escapeHtml(primary.notes.trim())}</div>` : ''}
</div>
${inGroup ? `<div class="item-flag"><span class="tick"></span> ${escapeHtml(IN_GROUP_TICKET_LABEL)}</div>` : ''}
</body></html>`;
}

import type { Cloth, Staff } from '../types';
import { APP_NAME } from './app-config';
import { PRINT_BARCODE } from './barcode';
import { IN_GROUP_TICKET_LABEL } from './utils';
import { pairMeasurementRows } from './measurements';
import { buildStaffTicketView } from './print-ticket';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Full staff barcode card: date/order header, scan code, then garment table. */
export function buildBarcodeCardHtml(
  cloths: Cloth[],
  barcodeDataUrl: string,
  orderCode: string,
  options?: { cutter?: Staff | null; tailor?: Staff | null; logoDataUrl?: string },
) {
  const view = buildStaffTicketView(cloths, options);
  if (!view) return '';

  const measRows = pairMeasurementRows(view.measurements)
    .map(([left, right]) => {
      const rightCell = right
        ? `<td class="k">${escapeHtml(right.label)}</td><td class="v">${escapeHtml(right.value)}</td>`
        : `<td class="k"></td><td class="v"></td>`;
      return `<tr><td class="k">${escapeHtml(left.label)}</td><td class="v">${escapeHtml(left.value)}</td>${rightCell}</tr>`;
    })
    .join('');

  const details = [
    view.customerName ? `<div class="meta"><span>Customer</span><strong>${escapeHtml(view.customerName)}</strong></div>` : '',
    view.qty > 1 ? `<div class="meta"><span>Qty</span><strong>${view.qty}</strong></div>` : '',
    view.cutterName ? `<div class="meta"><span>Cutter</span><strong>${escapeHtml(view.cutterName)}</strong></div>` : '',
    view.tailorName ? `<div class="meta"><span>Tailor</span><strong>${escapeHtml(view.tailorName)}</strong></div>` : '',
    view.deliveryDate ? `<div class="meta"><span>Delivery</span><strong>${escapeHtml(view.deliveryDate)}</strong></div>` : '',
    view.cutterBy ? `<div class="meta"><span>Cutter by</span><strong>${escapeHtml(view.cutterBy)}</strong></div>` : '',
    view.tailorBy ? `<div class="meta"><span>Tailor by</span><strong>${escapeHtml(view.tailorBy)}</strong></div>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(orderCode)}</title>
<style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
@page{size:80mm auto;margin:2mm}
html,body{width:76mm}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;text-align:left;padding:3mm 2mm;margin:0;color:#000;background:#fff}
.shop{font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;text-align:center;margin:0 0 2mm}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;margin:0 0 2mm}
.date,.order{font-size:12px;font-weight:800;line-height:1.2}
.order{text-align:right;font-family:ui-monospace,monospace;letter-spacing:0.04em}
.barcode-wrap{display:block;padding:1mm 0 1.5mm;background:#fff;text-align:center}
.barcode-wrap img{display:block;width:${PRINT_BARCODE.cssWidth};max-width:${PRINT_BARCODE.cssWidth};height:${PRINT_BARCODE.cssHeight};max-height:${PRINT_BARCODE.cssHeight};object-fit:contain;object-position:center;margin:0 auto;image-rendering:pixelated;image-rendering:crisp-edges}
.code{font-size:16px;font-weight:900;color:#000;margin:0 0 2.5mm;letter-spacing:1.5px;font-family:ui-monospace,monospace;text-align:center}
.garment{background:transparent;color:#000;font-size:14px;font-weight:900;padding:0 0 2mm;margin:0;letter-spacing:0.01em;line-height:1.25}
.meas{width:100%;border-collapse:collapse;margin:0 0 2.5mm;table-layout:fixed}
.meas td{border:1px solid #000;padding:1.4mm 1.6mm;vertical-align:top}
.meas .k{width:22%;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em}
.meas .v{width:28%;font-size:12px;font-weight:900}
.meta{display:flex;justify-content:space-between;gap:3mm;font-size:11px;font-weight:600;margin:1.2mm 0}
.meta span{color:#000}
.note{margin-top:2mm;padding-top:2mm;border-top:1px dashed #000;font-size:12px;font-weight:800;line-height:1.35;white-space:pre-wrap;word-break:break-word}
.item-flag{margin-top:2mm;padding-top:2mm;border-top:1px dashed #000;font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
.tick{display:inline-block;width:0.45em;height:0.85em;border-right:0.22em solid #000;border-bottom:0.22em solid #000;transform:rotate(45deg);margin:0 0.15em 0.2em 0.05em;flex-shrink:0}
@media print{body{padding:0}}
</style></head><body>
<div class="shop">${escapeHtml(APP_NAME)}</div>
<div class="top">
  <div class="date">${escapeHtml(view.dateLabel || '—')}</div>
  <div class="order">${escapeHtml(view.orderNumber || orderCode)}</div>
</div>
<div class="barcode-wrap">
  <img src="${barcodeDataUrl}" alt="Barcode ${escapeHtml(orderCode)}"/>
</div>
<div class="code">${escapeHtml(orderCode)}</div>
<div class="garment">${escapeHtml(view.garmentTitle)}</div>
${measRows ? `<table class="meas">${measRows}</table>` : ''}
${details}
${view.notes ? `<div class="note">Note: ${escapeHtml(view.notes)}</div>` : ''}
${view.inGroup ? `<div class="item-flag"><span class="tick"></span> ${escapeHtml(IN_GROUP_TICKET_LABEL)}</div>` : ''}
</body></html>`;
}

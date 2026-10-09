import type { Cloth, Staff } from '../types';
import { IN_GROUP_TICKET_LABEL } from './utils';
import { buildStaffTicketView } from './print-ticket';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Staff ticket: delivery + barcode + order, then name, phone, garment, measurements. */
export function buildBarcodeCardHtml(
  cloths: Cloth[],
  barcodeDataUrl: string,
  orderCode: string,
  options?: { cutter?: Staff | null; tailor?: Staff | null; logoDataUrl?: string },
) {
  const view = buildStaffTicketView(cloths, options);
  if (!view) return '';

  const measRows = view.measurements
    .map(
      (cell) =>
        `<div class="meas-row"><span class="k">${escapeHtml(cell.label)}</span><span class="dash">-</span><span class="v">${escapeHtml(cell.value)}</span></div>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(orderCode)}</title>
<style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
@page{size:80mm auto;margin:0}
html,body{width:76mm}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;text-align:left;padding:0 2mm 10mm;margin:0;color:#000;background:#fff}
.banner{display:flex;align-items:flex-start;justify-content:space-between;gap:1mm;margin:0 0 0.4mm;width:100%}
.date,.order{flex:1 1 0;min-width:18mm;line-height:1.1;word-break:break-word}
.date{text-align:left}
.order{text-align:right}
.banner .lbl{font-size:9px;font-weight:500;margin-bottom:0.4mm}
.banner .val{font-size:15px;font-weight:700}
.order .val{font-family:ui-monospace,monospace;letter-spacing:0.02em}
.barcode-col{flex:0 1 30mm;min-width:0;text-align:center;padding-top:2.4mm}
.barcode-col img{display:block;width:30mm;max-width:100%;height:9mm;object-fit:contain;object-position:center;margin:0 auto;image-rendering:pixelated;image-rendering:crisp-edges}
.code{font-size:11px;font-weight:600;color:#000;margin:0.4mm 0 2.5mm;letter-spacing:1px;font-family:ui-monospace,monospace;text-align:center}
.who{font-size:16px;font-weight:700;line-height:1.25;margin:1.4mm 0;word-break:break-word}
.garment{font-size:18px;font-weight:700;padding:1mm 0 2mm;margin:2mm 0 1mm;line-height:1.2;text-decoration:underline;text-underline-offset:2px}
.meas{margin:0 0 2mm}
.meas-row{display:flex;align-items:baseline;gap:2mm;font-size:13px;font-weight:500;padding:0.7mm 0}
.meas-row .k{min-width:22mm}
.meas-row .dash{flex:0 0 auto}
.meas-row .v{font-weight:600}
.note{margin-top:2mm;font-size:13px;font-weight:500;line-height:1.35;white-space:pre-wrap;word-break:break-word}
.item-flag{margin-top:2mm;padding-top:2mm;border-top:1px dashed #000;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.tick{display:inline-block;width:0.45em;height:0.85em;border-right:0.22em solid #000;border-bottom:0.22em solid #000;transform:rotate(45deg);margin:0 0.15em 0.2em 0.05em;flex-shrink:0}
@media print{body{padding:0 2mm 10mm 0}}
</style></head><body>
<div class="banner">
  <div class="date">
    <div class="lbl">Delivery Date</div>
    <div class="val">${escapeHtml(view.dateLabel || '—')}</div>
  </div>
  <div class="barcode-col">
    <img src="${barcodeDataUrl}" alt="Barcode ${escapeHtml(orderCode)}"/>
  </div>
  <div class="order">
    <div class="lbl">Order No</div>
    <div class="val">${escapeHtml(view.orderNumber || orderCode)}</div>
  </div>
</div>
<div class="code">${escapeHtml(orderCode)}</div>
<div class="who">Customer Name - ${escapeHtml(view.customerName || '')}</div>
<div class="who">Contact No - ${escapeHtml(view.customerPhone || '')}</div>
${view.garmentTitle ? `<div class="garment">${escapeHtml(view.garmentTitle)}</div>` : ''}
${measRows ? `<div class="meas">${measRows}</div>` : ''}
<div class="note">Note - ${view.notes ? escapeHtml(view.notes) : ''}</div>
${view.inGroup ? `<div class="item-flag"><span class="tick"></span> ${escapeHtml(IN_GROUP_TICKET_LABEL)}</div>` : ''}
</body></html>`;
}

/**
 * Google Sheets — Back-in-stock / Notify Me form
 *
 * SETUP:
 * 1. Create a Google Sheet with headers in row 1:
 *    Timestamp | Name | Phone | Email | Product | Variant | Variant ID | Product URL | Source
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into Shopify theme:
 *    Product information + Helium Mobile First Fold → "Google Sheets webhook URL"
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};

    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    sheet.appendRow([
      new Date(),
      data.name || '',
      data.phone || '',
      data.email || '',
      data.product || '',
      data.variant || '',
      data.variant_id || '',
      data.product_url || '',
      data.source || 'shopify-notify'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return doPost({ parameter: e.parameter, postData: null });
}

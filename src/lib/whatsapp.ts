import { APP_NAME } from './app-config';
import { isSupabaseConfigured, supabase } from './supabase';
import { customerBillItemLabel, groupClothsForCustomerBill } from './customer-order';
import { formatCalendarDate } from './utils';
import type { Cloth } from '../types';

export type WhatsAppSendStatus = 'sent' | 'unconfigured' | 'failed';

export type WhatsAppSendResult = {
  ok: boolean;
  status: WhatsAppSendStatus;
  message: string;
};

export type WhatsAppSendPayload = {
  phone: string;
  name: string;
  orderNumber: string;
  items: string;
  message: string;
};

/** Indian shop numbers: 10 digits, or 91 / +91 prefix. Empty is allowed. */
export function toWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^0[6-9]/.test(digits)) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]/.test(digits)) {
    return digits;
  }
  return null;
}

export function normalizeCustomerPhone(raw: string): { ok: true; phone: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, phone: '' };
  if (!toWhatsAppNumber(trimmed)) {
    return {
      ok: false,
      error: 'Enter a valid 10-digit mobile number, or leave it empty if the customer has no number.',
    };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return { ok: true, phone: digits.slice(2) };
  if (digits.length === 11 && digits.startsWith('0')) return { ok: true, phone: digits.slice(1) };
  return { ok: true, phone: digits.slice(-10) };
}

export function buildOrderConfirmationMessage(cloths: Cloth[]) {
  const first = cloths[0];
  const orderNumber = first?.code ?? '—';
  const name = first?.customerName?.trim() || 'Customer';
  const items = groupClothsForCustomerBill(cloths).map(customerBillItemLabel).join(', ');
  const pieceLabel = cloths.length === 1 ? '1 piece' : `${cloths.length} pieces`;

  return [
    `Hello ${name},`,
    '',
    `Your order is confirmed at ${APP_NAME}.`,
    '',
    `Order number: ${orderNumber}`,
    `Items (${pieceLabel}): ${items}`,
    first?.givenDate ? `Order date: ${formatCalendarDate(first.givenDate)}` : null,
    first?.deliveryDate ? `Delivery date: ${formatCalendarDate(first.deliveryDate)}` : null,
    '',
    'We will message you when it is ready. Thank you!',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function openWhatsAppPlaceholder() {
  if (window.tailorDesktop) return null;
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
}

function whatsappChatUrl(phone: string, text: string) {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppMessage(phone: string, text: string, popup?: Window | null) {
  const url = whatsappChatUrl(phone, text);
  if (!url) {
    popup?.close();
    return false;
  }

  if (window.tailorDesktop?.openExternal) {
    popup?.close();
    void window.tailorDesktop.openExternal(url);
    return true;
  }

  if (popup && !popup.closed) {
    popup.location.href = url;
    return true;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return true;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export function sendOrderConfirmationWhatsApp(
  cloths: Cloth[],
  phone: string,
  popup?: Window | null,
) {
  if (cloths.length === 0) {
    popup?.close();
    return false;
  }
  return openWhatsAppMessage(phone, buildOrderConfirmationMessage(cloths), popup);
}

export function buildWhatsAppSendPayload(cloths: Cloth[], phone: string): WhatsAppSendPayload | null {
  const number = toWhatsAppNumber(phone);
  const first = cloths[0];
  if (!number || !first) return null;
  return {
    phone: number,
    name: first.customerName?.trim() || 'Customer',
    orderNumber: first.code || '—',
    items: groupClothsForCustomerBill(cloths).map(customerBillItemLabel).join(', '),
    message: buildOrderConfirmationMessage(cloths),
  };
}

function asSendResult(value: unknown): WhatsAppSendResult | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { ok?: unknown; status?: unknown; message?: unknown };
  if (record.ok === true) {
    return {
      ok: true,
      status: 'sent',
      message: typeof record.message === 'string' ? record.message : 'WhatsApp confirmation sent',
    };
  }
  if (record.status === 'unconfigured' || record.status === 'failed' || record.status === 'sent') {
    return {
      ok: false,
      status: record.status === 'sent' ? 'failed' : record.status,
      message:
        typeof record.message === 'string'
          ? record.message
          : 'WhatsApp confirmation could not be sent',
    };
  }
  return null;
}

async function sendViaLocalApi(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult | null> {
  try {
    const res = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    const json = (await res.json().catch(() => null)) as unknown;
    const parsed = asSendResult(json);
    if (parsed) return parsed;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 501 ? 'unconfigured' : 'failed',
        message: 'WhatsApp confirmation could not be sent',
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function sendViaSupabaseFunction(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', { body: payload });
    const parsed = asSendResult(data);
    if (parsed) return parsed;
    const message = error?.message || '';
    if (/not found|404|Failed to send a request/i.test(message)) return null;
    if (error) {
      return { ok: false, status: 'failed', message };
    }
  } catch {
    return null;
  }
  return null;
}

/** Sends the confirmation through WhatsApp Cloud API. Does not open the WhatsApp app. */
export async function sendOrderConfirmationSilent(
  cloths: Cloth[],
  phone: string,
): Promise<WhatsAppSendResult> {
  const payload = buildWhatsAppSendPayload(cloths, phone);
  if (!payload) {
    return { ok: false, status: 'failed', message: 'Enter a valid WhatsApp number' };
  }

  if (window.tailorDesktop?.sendWhatsApp) {
    try {
      const desktop = asSendResult(await window.tailorDesktop.sendWhatsApp(payload));
      if (desktop && (desktop.ok || desktop.status !== 'unconfigured')) return desktop;
    } catch {
      // fall through to browser/server send
    }
  }

  const local = await sendViaLocalApi(payload);
  if (local && (local.ok || local.status !== 'unconfigured')) return local;

  const cloud = await sendViaSupabaseFunction(payload);
  if (cloud) return cloud;

  return {
    ok: false,
    status: 'unconfigured',
    message:
      'WhatsApp Business API is not set up yet. Confirmation cannot be sent without opening WhatsApp.',
  };
}

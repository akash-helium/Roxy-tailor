import { useEffect, useRef } from 'react';
import {
  normalizeScannerBarcode,
  isScanTerminatorKey,
  looksLikeScanPayload,
  SCANNER_BUFFER_MS,
  SCAN_CHAR_GAP_MS,
} from '../lib/scanner-input';

type Options = {
  enabled?: boolean;
  onScan: (code: string) => void;
};

function isScannerInput(target: EventTarget | null) {
  return target instanceof HTMLElement && target.dataset.scannerInput !== undefined;
}

function isTypingField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.dataset.allowTyping !== undefined) return true;
  if (target.dataset.scannerInput !== undefined) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function clearInputElement(el: HTMLInputElement) {
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * QuickScan WL2 / FINGERS 2.4 GHz laser — HID keyboard wedge.
 * Types the code then usually sends Enter. Some units omit Enter; we also
 * flush the buffer after a short idle if the payload looks complete.
 */
export function useHardwareScanner({ enabled = true, onScan }: Options) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyAtRef = useRef(0);
  const onScanRef = useRef(onScan);

  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function resetBuffer() {
      bufferRef.current = '';
      lastKeyAtRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function clearActiveScanField() {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        (active.dataset.allowTyping !== undefined || active.dataset.scannerInput !== undefined)
      ) {
        clearInputElement(active);
      }
    }

    function emitScan(raw: string, event?: KeyboardEvent) {
      const code = normalizeScannerBarcode(raw);
      resetBuffer();
      if (!code) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      clearActiveScanField();
      onScanRef.current(code);
    }

    function scheduleIdleFlush() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const raw = bufferRef.current;
        if (raw && looksLikeScanPayload(raw)) {
          emitScan(raw);
        } else {
          resetBuffer();
        }
      }, SCANNER_BUFFER_MS);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();
      const gap = lastKeyAtRef.current > 0 ? now - lastKeyAtRef.current : Number.POSITIVE_INFINITY;
      const rapidBurst = gap < SCAN_CHAR_GAP_MS;

      if (isScannerInput(event.target)) {
        if (isScanTerminatorKey(event.key)) {
          const el = event.target as HTMLInputElement;
          emitScan(el.value || bufferRef.current, event);
          clearInputElement(el);
        }
        return;
      }

      if (isScanTerminatorKey(event.key)) {
        if (bufferRef.current) {
          emitScan(bufferRef.current, event);
          return;
        }
        if (event.target instanceof HTMLInputElement && event.target.value.trim()) {
          const typed = event.target.value;
          if (rapidBurst || looksLikeScanPayload(typed)) {
            emitScan(typed, event);
            clearInputElement(event.target);
          }
        }
        return;
      }

      if (event.key.length !== 1) return;

      lastKeyAtRef.current = now;

      if (isTypingField(event.target) && !rapidBurst) {
        bufferRef.current = event.key;
        scheduleIdleFlush();
        return;
      }

      if (isTypingField(event.target) && rapidBurst) {
        event.preventDefault();
        event.stopPropagation();
        bufferRef.current += event.key;
        scheduleIdleFlush();
        return;
      }

      bufferRef.current += event.key;
      scheduleIdleFlush();
    }

    function onCaptureInput(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !isScannerInput(target)) return;
      if (!target.value) return;
      bufferRef.current = target.value;
      scheduleIdleFlush();
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('input', onCaptureInput, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('input', onCaptureInput, true);
      resetBuffer();
    };
  }, [enabled]);
}

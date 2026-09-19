import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { supportsHardwareScanner } from '../lib/platform';

type ScanListener = (code: string) => void;

type HardwareScannerContextValue = {
  enabled: boolean;
  lastScan: string | null;
  lastScanAt: number | null;
  subscribe: (listener: ScanListener) => () => void;
};

const HardwareScannerContext = createContext<HardwareScannerContextValue | null>(null);

const captureRef: { current: HTMLInputElement | null } = { current: null };

/** Keep the hidden wedge capture focused so every scan is received. */
export function refocusScannerCapture() {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.allowTyping !== undefined) return;
    captureRef.current?.focus({ preventScroll: true });
  }, 0);
}

function ScannerCaptureInput({ enabled }: { enabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enabled) return;
    captureRef.current = inputRef.current;
    refocusScannerCapture();

    function shouldRefocus() {
      const active = document.activeElement;
      if (!active || active === document.body) return true;
      if (active instanceof HTMLElement && active.dataset.scannerInput !== undefined) return false;
      if (active instanceof HTMLElement && active.dataset.allowTyping !== undefined) return false;
      return true;
    }

    function tick() {
      if (shouldRefocus()) refocusScannerCapture();
    }

    const interval = window.setInterval(tick, 800);
    document.addEventListener('focusin', tick);
    return () => {
      captureRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener('focusin', tick);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <input
      ref={inputRef}
      data-scanner-input
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-hidden
      tabIndex={0}
      className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
    />
  );
}

export function HardwareScannerProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<ScanListener>());
  const lastEmittedRef = useRef({ code: '', at: 0 });
  const enabled = supportsHardwareScanner();
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);

  const subscribe = useCallback((listener: ScanListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useHardwareScanner({
    enabled,
    onScan: (code) => {
      const now = Date.now();
      if (code === lastEmittedRef.current.code && now - lastEmittedRef.current.at < 800) {
        return;
      }
      lastEmittedRef.current = { code, at: now };
      setLastScan(code);
      setLastScanAt(now);
      for (const listener of listenersRef.current) {
        listener(code);
      }
      refocusScannerCapture();
    },
  });

  const value = useMemo(
    () => ({ enabled, lastScan, lastScanAt, subscribe }),
    [enabled, lastScan, lastScanAt, subscribe],
  );

  return (
    <HardwareScannerContext.Provider value={value}>
      <ScannerCaptureInput enabled={enabled} />
      {children}
    </HardwareScannerContext.Provider>
  );
}

export function useHardwareScannerBus() {
  const ctx = useContext(HardwareScannerContext);
  if (!ctx) {
    throw new Error('useHardwareScannerBus must be used within HardwareScannerProvider');
  }
  return ctx;
}

/** Safe when provider may be absent (e.g. login page). */
export function useHardwareScannerBusOptional() {
  return useContext(HardwareScannerContext);
}

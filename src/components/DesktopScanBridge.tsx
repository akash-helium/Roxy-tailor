import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHardwareScannerBus } from '../contexts/HardwareScannerContext';

/** Routes wireless/USB barcode scans to the dashboard from other pages. */
export function DesktopScanBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled, subscribe } = useHardwareScannerBus();

  useEffect(() => {
    if (!enabled) return;
    return subscribe((code) => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.dataset.allowTyping !== undefined) return;
      if (location.pathname === '/') return;
      navigate('/', { state: { scanCode: code, t: Date.now() } });
    });
  }, [enabled, subscribe, navigate, location.pathname]);

  return null;
}

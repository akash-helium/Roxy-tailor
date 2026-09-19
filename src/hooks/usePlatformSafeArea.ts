import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

function readSafeInset(edge: 'top' | 'bottom') {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:0;' +
    (edge === 'top'
      ? 'padding-top:env(safe-area-inset-top);'
      : 'padding-bottom:env(safe-area-inset-bottom);');
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const value = parseFloat(edge === 'top' ? style.paddingTop : style.paddingBottom) || 0;
  document.body.removeChild(probe);
  return value;
}

export function usePlatformSafeArea() {
  useEffect(() => {
    const root = document.documentElement;
    const isAndroid = Capacitor.getPlatform() === 'android';

    const update = () => {
      if (isAndroid) {
        return;
      }

      const top = readSafeInset('top');
      const bottom = readSafeInset('bottom');

      root.style.setProperty('--app-safe-top', `${top}px`);
      root.style.setProperty('--app-safe-bottom', `${bottom}px`);
    };

    update();
    window.visualViewport?.addEventListener('resize', update);
    return () => window.visualViewport?.removeEventListener('resize', update);
  }, []);
}

import { Capacitor } from '@capacitor/core';

export function isNativeMobile() {
  return Capacitor.isNativePlatform();
}

export function isElectron() {
  return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
}

/** Desktop app (Electron) or wide browser — use sidebar layout + USB scanner. */
export function isDesktopApp() {
  if (isNativeMobile()) return false;
  if (isElectron()) return true;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 1024px)').matches;
}

export function supportsHardwareScanner() {
  if (typeof window === 'undefined') return false;
  // HID keyboard-wedge scanners (FINGERS QuickScan WL2, etc.) work on desktop and Android with USB dongle.
  return isDesktopApp() || isNativeMobile();
}

export function supportsCameraScanner() {
  return isNativeMobile() || (!isElectron() && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia));
}

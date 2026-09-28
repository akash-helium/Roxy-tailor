import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isElectron, isNativeMobile } from './platform';
import {
  appVersion,
  fetchOtaManifest,
  isNewerVersion,
  nativeAllowsBundle,
} from './ota';

export type OtaStatus = {
  current: string;
  available: string | null;
  ready: boolean;
  notes?: string;
};

function currentLabel(value: string) {
  return !value || value === 'builtin' ? appVersion() : value;
}

export async function prepareOta(): Promise<OtaStatus> {
  if (isElectron()) {
    await window.tailorDesktop?.otaNotifyReady?.();
    const status = await window.tailorDesktop?.otaStatus?.();
    return {
      current: status?.current || appVersion(),
      available: status?.available ?? null,
      ready: Boolean(status?.ready),
      notes: status?.notes,
    };
  }

  if (!isNativeMobile()) {
    return { current: appVersion(), available: null, ready: false };
  }

  await CapacitorUpdater.notifyAppReady();
  const running = await CapacitorUpdater.current();
  const current = currentLabel(running.bundle.version);
  const manifest = await fetchOtaManifest();
  if (!manifest || !nativeAllowsBundle(manifest, appVersion()) || !isNewerVersion(manifest.version, current)) {
    return { current, available: null, ready: false };
  }

  let downloaded;
  try {
    downloaded = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    });
  } catch {
    downloaded = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });
  }
  await CapacitorUpdater.next({ id: downloaded.id });
  return { current, available: manifest.version, ready: true, notes: manifest.notes };
}

export async function applyOtaNow() {
  if (isElectron()) {
    await window.tailorDesktop?.otaRelaunch?.();
    return;
  }
  if (isNativeMobile()) {
    await CapacitorUpdater.reload();
  }
}

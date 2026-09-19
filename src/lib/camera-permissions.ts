import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

export type CameraAccessResult = {
  granted: boolean;
  message?: string;
};

export async function ensureCameraAccess(): Promise<CameraAccessResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true };
  }

  let status = await Camera.checkPermissions();
  if (status.camera === 'granted' || status.camera === 'limited') {
    return { granted: true };
  }

  status = await Camera.requestPermissions({ permissions: ['camera'] });
  if (status.camera === 'granted' || status.camera === 'limited') {
    return { granted: true };
  }

  if (status.camera === 'denied') {
    return {
      granted: false,
      message:
        'Camera access denied. Open Settings → Apps → Roxy Tailor → Permissions and allow Camera.',
    };
  }

  return {
    granted: false,
    message: 'Camera permission is required to scan barcodes.',
  };
}

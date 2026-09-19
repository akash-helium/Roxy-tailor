import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/** Close overlay on Android hardware back instead of exiting the app. */
export function useAndroidBackHandler(onBack: () => void, enabled = true) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !enabled) return;

    let remove: (() => void) | undefined;

    App.addListener('backButton', () => {
      onBack();
    }).then((handle) => {
      remove = () => handle.remove();
    });

    return () => {
      remove?.();
    };
  }, [onBack, enabled]);
}

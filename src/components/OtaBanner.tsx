import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyOtaNow, prepareOta } from '../lib/ota-runtime';
import { Button } from './ui';

export function OtaBanner() {
  const [readyVersion, setReadyVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void prepareOta()
      .then((status) => {
        if (!cancelled && status.ready && status.available) {
          setReadyVersion(status.available);
        }
      })
      .catch(() => undefined);

    const stop = window.tailorDesktop?.onOtaReady?.((payload) => {
      if (payload.version) setReadyVersion(payload.version);
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (!readyVersion) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-[350] flex justify-center px-4 sm:bottom-6">
      <div className="flex max-w-lg items-center gap-3 rounded-xl border border-action/25 bg-white px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-ink">
          Update {readyVersion} is ready. Restart to use it.
        </p>
        <Button size="sm" onClick={() => void applyOtaNow()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Restart
        </Button>
      </div>
    </div>
  );
}

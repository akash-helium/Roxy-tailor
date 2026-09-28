export type OtaManifest = {
  version: string;
  url: string;
  checksum?: string;
  minNativeVersion?: string;
  notes?: string;
};

export function defaultOtaManifestUrl() {
  const explicit = import.meta.env.VITE_OTA_MANIFEST_URL?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (
    import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  ).replace(/\/$/, '');
  if (!supabaseUrl) return '';
  return `${supabaseUrl}/storage/v1/object/public/app-ota/latest.json`;
}

export function appVersion() {
  return import.meta.env.VITE_APP_VERSION || '0.0.0';
}

export function parseVersion(value: string) {
  return String(value)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(next: string, current: string) {
  const a = parseVersion(next);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

export function nativeAllowsBundle(manifest: OtaManifest, nativeVersion: string) {
  if (!manifest.minNativeVersion) return true;
  return !isNewerVersion(manifest.minNativeVersion, nativeVersion);
}

export async function fetchOtaManifest(manifestUrl = defaultOtaManifestUrl()): Promise<OtaManifest | null> {
  if (!manifestUrl) return null;
  const response = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<OtaManifest>;
  if (!data.version || !data.url) return null;
  return {
    version: String(data.version),
    url: String(data.url),
    checksum: data.checksum ? String(data.checksum) : undefined,
    minNativeVersion: data.minNativeVersion ? String(data.minNativeVersion) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

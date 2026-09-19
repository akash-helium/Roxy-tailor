import { APP_LOGO_SRC } from './app-config';

let cachedLogoDataUrl: string | null = null;

export async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch(APP_LOGO_SRC);
    if (!res.ok) return '';
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    return '';
  }
}

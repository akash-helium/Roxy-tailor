/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

type TailorDesktopApi = {
  printRaw: (base64: string) => Promise<{ ok: boolean; message: string; printer?: string }>;
  listPrinters: () => Promise<Array<{ name: string; isDefault?: boolean; portName?: string }>>;
  openExternal: (url: string) => Promise<{ ok: boolean; message?: string }>;
  sendWhatsApp: (payload: {
    phone: string;
    name: string;
    orderNumber: string;
    items: string;
    message: string;
  }) => Promise<{ ok: boolean; status?: string; message: string }>;
};

interface Window {
  tailorDesktop?: TailorDesktopApi;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

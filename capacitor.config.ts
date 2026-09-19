import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tailor.app',
  appName: 'Roxy Tailor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

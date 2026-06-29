import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'FW_PROTO',
  webDir: 'www',
  android: {
    allowMixedContent: true,
    adjustMarginsForEdgeToEdge: 'disable',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smart.pantry',
  appName: 'Stock & Spoon',
  webDir: 'dist',
  // Remove server config for production builds - Capacitor will load from webDir
  // server: {
  //   androidScheme: 'com.smart.pantry',
  //   iosScheme: 'com.smart.pantry'
  // },
  plugins: {
    App: {
      // App plugin configuration
    },
    Device: {
      // Device plugin configuration
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Calendar: {
    //   // Calendar plugin configuration - temporarily disabled due to build compatibility
    // },
    SafeArea: {
      // Safe area plugin configuration
    },
    Haptics: {
      // Haptics plugin configuration
    },
    // CapacitorHttp: {
    //   enabled: true,
    //   excludePatterns: ["*firestore.googleapis.com*"]
    // },
    Browser: {
      // toolbarColor: '#2A0A10'
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '13848266518-0co4dav6sn9epov13vt0covii2nmg1ne.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  // App icon configuration (icons are handled by the build pipeline)
};

export default config;

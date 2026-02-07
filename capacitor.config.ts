import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smart.pantry',
  appName: 'Smart Pantry',
  webDir: 'dist',
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
    // CapacitorHttp: {
    //   enabled: true,
    //   excludePatterns: ["*firestore.googleapis.com*"]
    // },
    // Browser: {
    //   toolbarColor: '#2A0A10'
    // }
  },
  // App icon configuration
  android: {
    icon: 'public/icons/smartpantryicon.png'
  },
  ios: {
    icon: 'public/icons/smartpantryicon.png'
  }
};

export default config;

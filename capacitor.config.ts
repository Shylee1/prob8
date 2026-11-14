export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    iosScheme?: string;
  };
  plugins?: Record<string, Record<string, unknown>>;
}

const config: CapacitorConfig = {
  appId: 'com.prob8.app',
  appName: 'Prob8',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      enableHighAccuracy: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#090D16',
      showSpinner: false,
    },
  },
};

export default config;

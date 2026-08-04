import { useEffect, useRef } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { AdMob } from '@capacitor-community/admob';
import { User } from '../types';
import { Tab } from '../types/app';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { destroyReceiptOcrWorker } from '../services/receiptOcrService';
import { cleanupCacheService } from '../services/cacheService';
import { initCurrency } from '../services/currencyService';
import { initializePurchaseStore } from '../services/purchaseService';
import SafeAreaService from '../services/safeAreaService';
import PerformanceMonitoringService from '../services/performanceMonitoringService';
import { cameraRestoredStore } from '../utils/cameraRestoredStore';
import { pushNotificationService } from '../services/pushNotificationService';
import AnalyticsService from '../services/analyticsService';
import { closeTopAndroidModal } from './useAndroidBack';
import { log } from '../services/logService';

interface UseAppLifecycleProps {
  user: User | null;
  activeTab: Tab;
  applyTabChange: (tab: Tab) => void;
  tabHistoryRef: React.MutableRefObject<Tab[]>;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', ttl?: number) => void;
  isAuthReady: boolean;
}

export function useAppLifecycle({
  user,
  activeTab: _activeTab,
  applyTabChange,
  tabHistoryRef,
  addToast,
  isAuthReady: _isAuthReady,
}: UseAppLifecycleProps) {
  const backButtonListenerRef = useRef<PluginListenerHandle | null>(null);
  const appUrlOpenListenerRef = useRef<PluginListenerHandle | null>(null);
  const lastBackPressRef = useRef<number>(0);

  // Root lifecycle cleanup for monitoring and background workers
  useEffect(() => {
    return () => {
      DatabaseMonitoringService.cleanup();
      destroyReceiptOcrWorker();
      cleanupCacheService();
    };
  }, []);

  // Load exchange rates and apply user's preferred currency
  useEffect(() => {
    initCurrency(user?.profile?.currency).catch(() => {});
  }, [user?.profile?.currency]);

  // Initialize IAP store on Android on app launch
  useEffect(() => {
    if (user?.id && Capacitor.isNativePlatform()) {
      initializePurchaseStore(user.id).catch((err: unknown) => {
        log.error('Startup IAP store init error', { error: err instanceof Error ? err.message : String(err) }, 'App');
      });
    }
  }, [user?.id]);

  useEffect(() => {
    SafeAreaService.initialize().catch(error => log.error('Failed to initialize safe area service', { error }, 'App'));
  }, []);

  // Initialize AdMob on native platforms
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'web') {
      const useTestAds = import.meta.env.MODE !== 'production' || import.meta.env.VITE_ADMOB_USE_TEST === 'true';
      AdMob.initialize({
        initializeForTesting: useTestAds,
      }).catch((error) => {
        log.warn('AdMob failed to initialize on startup', error);
      });
    }
  }, []);

  // Handle Capacitor Camera restore after Android app restart due to low memory
  useEffect(() => {
    const handleRestoredResult = (data: import('@capacitor/app').RestoredListenerEvent) => {
      if (data.pluginId === 'Camera' && data.methodName === 'getPhoto' && data.success) {
        log.info('Recovered photo from appRestoredResult', undefined, 'App');
        const intent = localStorage.getItem('camera_intent');
        localStorage.removeItem('camera_intent');
        cameraRestoredStore.setRestoredData(data.data as import('@capacitor/camera').Photo, intent);
        window.dispatchEvent(new CustomEvent('cameraRestored'));
      }
    };

    const listener = CapacitorApp.addListener('appRestoredResult', handleRestoredResult);
    return () => {
      listener.then(l => l.remove()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    PerformanceMonitoringService.init();
    PerformanceMonitoringService.mark('app_open');
    return () => {
      PerformanceMonitoringService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      const checkAndInitializePush = async () => {
        if (Capacitor.isNativePlatform()) {
          try {
            const status = await PushNotifications.checkPermissions();
            if (status.receive === 'granted') {
              await pushNotificationService.initialize(user.id);
            } else {
              log.debug('Skipping push notification initialization on startup: permission not granted', { status }, 'App');
            }
          } catch (error) {
            log.error('Failed to check push notification permissions', { error }, 'App');
          }
        } else {
          await pushNotificationService.initialize(user.id);
        }
      };
      checkAndInitializePush();
    }
  }, [user?.id]);

  useEffect(() => {
    import('../services/imageCacheService')
      .then(({ initializeImageCache }) => {
        initializeImageCache().catch(error => {
          log.error('Failed to initialize image cache', { error }, 'App');
        });
      })
      .catch(error => {
        log.error('Failed to dynamically import image cache service', { error }, 'App');
      });

    AnalyticsService.trackAppOpen();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        AnalyticsService.trackAppBackground();
      } else {
        AnalyticsService.trackAppForeground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleBackButton = () => {
      if (closeTopAndroidModal()) return;

      if (tabHistoryRef.current.length > 0) {
        const prev = tabHistoryRef.current[tabHistoryRef.current.length - 1];
        tabHistoryRef.current = tabHistoryRef.current.slice(0, -1);
        applyTabChange(prev);
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastBackPressRef.current;

      if (timeDiff < 2000) {
        CapacitorApp.exitApp();
      } else {
        addToast('Press back again to exit', 'info', 2000);
        lastBackPressRef.current = currentTime;
      }
    };

    CapacitorApp.addListener('backButton', handleBackButton).then((listener) => {
      backButtonListenerRef.current = listener;
    }).catch((error) => {
      log.error('Failed to add back button listener', { error }, 'App');
    });

    CapacitorApp.addListener('appUrlOpen', (event) => {
      log.debug('App opened with URL:', event.url);
      if (event.url && event.url.startsWith('com.smart.pantry://')) {
        log.debug('Firebase auth redirect detected, URL:', event.url);
      }
    }).then((listener) => {
      appUrlOpenListenerRef.current = listener;
    }).catch((error) => {
      log.error('Failed to add app URL open listener', { error }, 'App');
    });

    return () => {
      if (backButtonListenerRef.current && backButtonListenerRef.current.remove) {
        backButtonListenerRef.current.remove();
        backButtonListenerRef.current = null;
      }
      if (appUrlOpenListenerRef.current && appUrlOpenListenerRef.current.remove) {
        appUrlOpenListenerRef.current.remove();
        appUrlOpenListenerRef.current = null;
      }
    };
  }, [addToast, applyTabChange, tabHistoryRef]);
}

import React from 'react';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Use Google's sample/test ad unit for development/testing:
// Banner test unit: ca-app-pub-3940256099942544/6300978111
// Production unit: ca-app-pub-5084706792909644/2077776375
const PROD_AD_UNIT = 'ca-app-pub-5084706792909644/2077776375';
const TEST_AD_UNIT = 'ca-app-pub-3940256099942544/6300978111';

const useTestAds = (): boolean => {
  // Vite environment flag: set VITE_ADMOB_USE_TEST=true to force test ads
  try {
    // import.meta might not be available in some tooling; guard access
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mode = typeof import.meta !== 'undefined' ? import.meta.env.MODE : process.env.NODE_ENV;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const force = typeof import.meta !== 'undefined' ? import.meta.env.VITE_ADMOB_USE_TEST : process.env.VITE_ADMOB_USE_TEST;
    return mode !== 'production' || String(force) === 'true';
  } catch (e) {
    return process.env.NODE_ENV !== 'production' || process.env.VITE_ADMOB_USE_TEST === 'true';
  }
};

export const AdMobBanner: React.FC = () => {
  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') {
      return;
    }

    const AD_UNIT_ID = useTestAds() ? TEST_AD_UNIT : PROD_AD_UNIT;

    AdMob.showBanner({
      adId: AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER
    }).catch((error) => {
      console.error('AdMob banner failed to show', error);
    });

    return () => {
      AdMob.hideBanner().catch((error) => {
        console.warn('AdMob banner hide failed', error);
      });
    };
  }, []);

  return null;
};

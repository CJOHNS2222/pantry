import React from 'react';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const AD_UNIT_ID = 'ca-app-pub-5084706792909644/2077776375';

export const AdMobBanner: React.FC = () => {
  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') {
      return;
    }

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

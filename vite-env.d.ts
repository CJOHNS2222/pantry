/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string
  readonly VITE_AUTH_DOMAIN: string
  readonly VITE_PROJECT_ID: string
  readonly VITE_STORAGE_BUCKET: string
  readonly VITE_MESSAGING_SENDER_ID: string
  readonly VITE_APP_ID: string
  readonly VITE_MEASUREMENT_ID: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_SPOONACULAR_API_KEY: string
  readonly VITE_USDA_API_KEY?: string
  readonly VITE_GOOGLE_CSE_API_KEY?: string
  readonly VITE_GOOGLE_CSE_ID?: string
  readonly VITE_UNSPLASH_ACCESS_KEY?: string
  readonly VITE_OPENROUTER_API_KEY?: string
  readonly VITE_OPENROUTER_BASE_URL?: string
  readonly VITE_OPENROUTER_MODEL?: string
  readonly VITE_OPENROUTER_VISION_MODEL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  readonly VITE_EMAILJS_SERVICE_ID?: string
  readonly VITE_EMAILJS_TEMPLATE_ID?: string
  readonly VITE_EMAILJS_PUBLIC_KEY?: string
  readonly VITE_ADMOB_ENABLED?: string
  readonly VITE_ADMOB_USE_TEST?: string
  readonly VITE_IMPACT_PUBLISHER_ID?: string
  readonly VITE_WALMART_CAMPAIGN_ID?: string
  readonly VITE_WALMART_AD_ID?: string
  readonly VITE_TARGET_CAMPAIGN_ID?: string
  readonly VITE_TARGET_AD_ID?: string
  readonly VITE_KROGER_CAMPAIGN_ID?: string
  readonly VITE_KROGER_AD_ID?: string
  readonly VITE_INSTACART_CAMPAIGN_ID?: string
  readonly VITE_INSTACART_AD_ID?: string
  readonly VITE_ALBERTSONS_CAMPAIGN_ID?: string
  readonly VITE_ALBERTSONS_AD_ID?: string
  readonly VITE_THRIVE_CAMPAIGN_ID?: string
  readonly VITE_THRIVE_AD_ID?: string
  // VITE_IMPACT_ACCOUNT_SID / VITE_IMPACT_AUTH_TOKEN intentionally removed - the Impact
  // Radius account credentials moved server-side (functions/src/impactTracking.ts,
  // Secret Manager) per .claude/audits/FIXES.md F04. Do NOT reintroduce these as
  // client-readable VITE_* vars.
  // Stripe and PayPal variables removed for Google Play Billing migration
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string;

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// Lightweight feature flag and usage tracking (localStorage-backed)
const GEMINI_ENABLED_ENV = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENABLE_GEMINI === 'true';
const DEFAULT_DAILY_CAP = 100; // default calls per user per day

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function isGeminiGloballyEnabled(): boolean {
  // Honor environment flag if present, otherwise enabled by default
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENABLE_GEMINI !== undefined) {
    return GEMINI_ENABLED_ENV;
  }
  return true;
}

export function userOptedInToGemini(userId?: string): boolean {
  try {
    const key = userId ? `gemini_opt_in_${userId}` : `gemini_opt_in_global`;
    const raw = localStorage.getItem(key);
    if (raw === null) return false;
    return raw === 'true';
  } catch (e) {
    return false;
  }
}

export function setUserGeminiOptIn(userId: string | undefined, value: boolean) {
  try {
    const key = userId ? `gemini_opt_in_${userId}` : `gemini_opt_in_global`;
    localStorage.setItem(key, value ? 'true' : 'false');
  } catch (e) {
    // ignore
  }
}

export function getGeminiUsage(userId?: string): number {
  try {
    const key = `gemini_usage_${userId || 'global'}_${todayKey()}`;
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : 0;
  } catch (e) {
    return 0;
  }
}

export function incrementGeminiUsage(userId: string | undefined, inc = 1) {
  try {
    const key = `gemini_usage_${userId || 'global'}_${todayKey()}`;
    const current = getGeminiUsage(userId) || 0;
    localStorage.setItem(key, String(current + inc));
    return current + inc;
  } catch (e) {
    return 0;
  }
}

export function canUseGemini(userId?: string, cap = DEFAULT_DAILY_CAP): boolean {
  if (!isGeminiGloballyEnabled()) return false;
  if (!userOptedInToGemini(userId)) return false;
  const used = getGeminiUsage(userId);
  return used < cap;
}

export default {
  isGeminiGloballyEnabled,
  userOptedInToGemini,
  setUserGeminiOptIn,
  getGeminiUsage,
  incrementGeminiUsage,
  canUseGemini,
};

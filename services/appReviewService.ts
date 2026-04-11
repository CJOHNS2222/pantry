/**
 * App review prompt service.
 *
 * Requests an in-app store review at meaningful user milestones using
 * @capawesome/capacitor-app-review on iOS/Android.
 * On web, does nothing (no web equivalent).
 *
 * Milestones that trigger a prompt:
 *   - User saves their 5th recipe
 *   - User completes a full week of meal planning
 *   - User scans 10 pantry items via camera
 *
 * Rate limiting: Only prompts once every 60 days maximum (OS may suppress
 * additional prompts independently). Uses localStorage to track last prompt date.
 */

import { Capacitor } from '@capacitor/core';
import { log } from './logService';

const STORAGE_KEY = 'stockspoon_last_review_prompt';
const MIN_DAYS_BETWEEN_PROMPTS = 60;

function daysSinceLastPrompt(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return Infinity;
  const lastMs = Number(raw);
  return (Date.now() - lastMs) / (1000 * 60 * 60 * 24);
}

function recordPromptShown(): void {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

/**
 * Request an App Store / Play Store review dialog.
 * No-op on web or if the rate limit hasn't elapsed.
 */
export async function requestAppReview(reason: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  if (daysSinceLastPrompt() < MIN_DAYS_BETWEEN_PROMPTS) {
    log.debug(`App review skipped (too soon). Reason: ${reason}`, {}, 'AppReviewService');
    return;
  }

  try {
    const { AppReview } = await import('@capawesome/capacitor-app-review');
    await AppReview.requestReview();
    recordPromptShown();
    log.info(`App review requested. Reason: ${reason}`, {}, 'AppReviewService');
  } catch (err: unknown) {
    // Non-fatal — the OS may silently suppress the dialog
    log.warn('App review request failed', { error: err instanceof Error ? err.message : String(err) }, 'AppReviewService');
  }
}

/** Call after user saves their Nth recipe. */
export async function maybeRequestReviewAfterRecipeSave(totalSaved: number): Promise<void> {
  if (totalSaved === 5 || totalSaved === 20) {
    await requestAppReview(`user_saved_${totalSaved}_recipes`);
  }
}

/** Call after user completes a full week of meal planning. */
export async function maybeRequestReviewAfterMealPlan(): Promise<void> {
  await requestAppReview('full_week_meal_plan_created');
}

/** Call after user scans their 10th pantry item via camera. */
export async function maybeRequestReviewAfterScanning(totalScanned: number): Promise<void> {
  if (totalScanned === 10 || totalScanned === 50) {
    await requestAppReview(`user_scanned_${totalScanned}_items`);
  }
}

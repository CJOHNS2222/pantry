import React from 'react';
import { Crown, Lock } from 'lucide-react';

/**
 * Shared "limit reached" / upgrade-prompt UI.
 *
 * Consolidates the previously hand-rolled paywall copy that was duplicated
 * across CategoryManager, RecipeFinderSavedView, PremiumFeature, etc. (see
 * FIXES.md F64). Two visual variants cover the shapes found in the wild:
 *
 * - `banner` — inline amber card used next to the content it's gating
 *   (e.g. "Free plan limit reached" in CategoryManager, the saved-recipes
 *   cap in RecipeFinderSavedView).
 * - `overlay` — full backdrop + dimmed-children card used by PremiumFeature
 *   to block an entire feature area behind a premium paywall.
 * - `inline` — compact, borderless single line (icon + text + implicit
 *   link) for embedding inside a progress-bar row or as a trailing CTA
 *   inside another sentence (e.g. SettingsUsageLimitsSection's per-metric
 *   warning lines, GroceryCostEstimator's "N shown — upgrade" link).
 */

export type PaywallTier = 'premium' | 'family';

export interface PaywallPromptProps {
  /** Human-readable name of the gated feature, e.g. "custom categories", "saved recipes". */
  feature: string;
  /** Overrides the auto-generated message. */
  message?: string;
  /** Secondary line shown under the message (banner variant only). */
  subMessage?: string;
  /** Numeric limit for the free tier, used to build the default message. */
  limit?: number;
  /** Current usage count, used to build the default message. */
  currentCount?: number;
  /** Which tier to point the user at. Defaults to 'premium'. */
  tier?: PaywallTier;
  /** Optional bullet list of perks, shown on the overlay variant. */
  perks?: string[];
  /** Label for the CTA button/link. */
  ctaLabel?: string;
  /** Called when the user taps the CTA. Typically navigates to Settings/Subscription. */
  onUpgrade: () => void;
  /** Visual shape. Defaults to 'banner'. */
  variant?: 'banner' | 'overlay' | 'inline';
  /** Overlay variant only: the content to dim/block behind the paywall card. */
  children?: React.ReactNode;
  /** Optional title override (overlay variant heading, banner variant bold line). */
  title?: string;
  className?: string;
}

function defaultMessage(feature: string, limit?: number, currentCount?: number): string {
  if (limit !== undefined && currentCount !== undefined) {
    return `Limit reached (${currentCount}/${limit} ${feature}) — upgrade for unlimited access.`;
  }
  if (limit !== undefined) {
    return `You've reached the free ${limit} ${feature} limit. Upgrade for unlimited access.`;
  }
  return `Unlock ${feature} by upgrading your plan.`;
}

export const PaywallPrompt: React.FC<PaywallPromptProps> = ({
  feature,
  message,
  subMessage,
  limit,
  currentCount,
  tier = 'premium',
  perks,
  ctaLabel,
  onUpgrade,
  variant = 'banner',
  children,
  title,
  className,
}) => {
  const resolvedMessage = message || defaultMessage(feature, limit, currentCount);
  const tierLabel = tier === 'family' ? 'Family' : 'Premium';

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className={`inline-flex items-center gap-1 text-left hover:underline transition-colors ${
          className || 'text-amber-600 hover:text-amber-700 text-xs'
        }`.trim()}
      >
        <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span>{resolvedMessage}</span>
        {ctaLabel && <span className="font-semibold">{ctaLabel}</span>}
      </button>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className={`premium-overlay-container ${className || ''}`.trim()}>
        <div className="premium-overlay-backdrop">
          <div className="premium-upgrade-modal">
            <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <h3 className="font-bold text-gray-900 mb-1">{title || 'Ready to Unlock More?'}</h3>
            <p className="text-sm text-gray-600 mb-3">{resolvedMessage}</p>
            {perks && perks.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                {perks.map((perk, i) => (
                  <p key={i} className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                    {perk}
                  </p>
                ))}
              </div>
            )}
            <button
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 transition-all"
              onClick={onUpgrade}
            >
              {ctaLabel || `Upgrade to ${tierLabel}`}
            </button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg flex items-start gap-3 ${className || ''}`.trim()}
    >
      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{title}</p>}
        <p className="text-sm text-amber-700 dark:text-amber-400">{resolvedMessage}</p>
        {subMessage && <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">{subMessage}</p>}
      </div>
      <button
        onClick={onUpgrade}
        className="text-xs font-bold text-[var(--accent-color)] shrink-0 hover:opacity-80 transition-opacity"
      >
        {ctaLabel || 'Upgrade'}
      </button>
    </div>
  );
};

export default PaywallPrompt;

import React, { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { type OnboardingMilestone, hasMilestone } from '../services/onboardingMilestoneService';

interface FeatureDiscoveryProps {
  featureId: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  targetElement?: string; // CSS selector for the element to highlight
  onDismiss: () => void;
  onAction?: () => void;
  actionLabel?: string;
  autoHideDelay?: number;
  showSparkles?: boolean;
  /** If provided, this discovery is suppressed until the user has reached the given milestone. */
  requiredMilestone?: OnboardingMilestone;
}

export const FeatureDiscovery: React.FC<FeatureDiscoveryProps> = ({
  featureId,
  title,
  description,
  icon = <Sparkles className="w-5 h-5" />,
  position = 'bottom-right',
  targetElement,
  onDismiss,
  onAction,
  actionLabel,
  autoHideDelay = 8000,
  showSparkles = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Check if this feature has been discovered before
    const discoveredFeatures = JSON.parse(localStorage.getItem('discovered-features') || '[]');
    if (discoveredFeatures.includes(featureId)) {
      return;
    }

    // Find target element
    if (targetElement) {
      const element = document.querySelector(targetElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    }

    // Show with animation
    setTimeout(() => setIsVisible(true), 500);

    // Auto-hide
    const timer = setTimeout(() => {
      handleDismiss();
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [featureId, targetElement, autoHideDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      // Mark as discovered
      const discoveredFeatures = JSON.parse(localStorage.getItem('discovered-features') || '[]');
      if (!discoveredFeatures.includes(featureId)) {
        discoveredFeatures.push(featureId);
        localStorage.setItem('discovered-features', JSON.stringify(discoveredFeatures));
      }
      onDismiss();
    }, 300);
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    handleDismiss();
  };

  const getPositionStyles = () => {
    const baseOffset = 20;

    switch (position) {
      case 'top-left':
        return {
          top: targetRect ? targetRect.top - baseOffset : baseOffset,
          left: targetRect ? targetRect.left : baseOffset,
          transform: 'translateY(-100%)'
        };
      case 'top-right':
        return {
          top: targetRect ? targetRect.top - baseOffset : baseOffset,
          right: targetRect ? window.innerWidth - targetRect.right : baseOffset,
          transform: 'translateY(-100%)'
        };
      case 'bottom-left':
        return {
          top: targetRect ? targetRect.bottom + baseOffset : 'auto',
          bottom: targetRect ? 'auto' : baseOffset,
          left: targetRect ? targetRect.left : baseOffset,
        };
      case 'bottom-right':
        return {
          top: targetRect ? targetRect.bottom + baseOffset : 'auto',
          bottom: targetRect ? 'auto' : baseOffset,
          right: targetRect ? window.innerWidth - targetRect.right : baseOffset,
        };
      case 'center':
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
      default:
        return {};
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop with highlight */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />

        {/* Target highlight */}
        {targetElement && targetRect && (
          <div
            className="absolute border-2 border-[var(--accent-color)] rounded-lg shadow-lg"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              animation: 'pulse 2s infinite'
            }}
          />
        )}

        {/* Sparkle effects */}
        {showSparkles && (
          <>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                style={{
                  top: `${20 + Math.random() * 60}%`,
                  left: `${20 + Math.random() * 60}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '2s'
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Feature discovery card */}
      <div
        className={`fixed z-50 max-w-sm bg-gradient-to-br from-[var(--accent-color)] to-[var(--accent-color)]/90 text-white rounded-2xl shadow-2xl p-6 transform transition-all duration-500 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={getPositionStyles()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              {icon}
            </div>
            <div>
              <h3 className="font-bold text-lg">New Feature!</h3>
              <p className="text-white/90 text-sm font-medium">{title}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-white/90 mb-6 leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          {onAction && actionLabel && (
            <button
              onClick={handleAction}
              className="flex-1 bg-white text-[var(--accent-color)] hover:bg-white/90 px-4 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              {actionLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-white/70 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>

        {/* Progress bar for auto-hide */}
        <div className="mt-4 w-full bg-white/20 rounded-full h-1">
          <div
            className="bg-white h-1 rounded-full transition-all duration-100 ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${autoHideDelay}ms linear forwards`
            }}
          />
        </div>
      </div>
    </>
  );
};

interface FeatureDiscoveryManagerProps {
  discoveries: Array<Omit<FeatureDiscoveryProps, 'onDismiss'>>;
  onDiscoveryDismiss?: (featureId: string) => void;
}

export const FeatureDiscoveryManager: React.FC<FeatureDiscoveryManagerProps> = ({
  discoveries,
  onDiscoveryDismiss
}) => {
  const [currentDiscovery, setCurrentDiscovery] = useState<FeatureDiscoveryProps | null>(null);
  const [queue, setQueue] = useState<FeatureDiscoveryProps[]>([]);

  useEffect(() => {
    // Check which discoveries haven't been seen AND whose milestone has been reached
    const discoveredFeatures = JSON.parse(localStorage.getItem('discovered-features') || '[]');

    const newDiscoveries = discoveries
      .filter(discovery => !discoveredFeatures.includes(discovery.featureId))
      .filter(discovery =>
        // If a required milestone is specified, gate on it; otherwise always eligible
        !discovery.requiredMilestone || hasMilestone(discovery.requiredMilestone)
      )
      .map(discovery => ({
        ...discovery,
        onDismiss: () => handleDiscoveryDismiss(discovery.featureId)
      }));

    if (newDiscoveries.length > 0) {
      setQueue(newDiscoveries);
      if (!currentDiscovery) {
        setCurrentDiscovery(newDiscoveries[0]);
      }
    }
  }, [discoveries]);

  const handleDiscoveryDismiss = (featureId: string) => {
    setCurrentDiscovery(null);
    onDiscoveryDismiss?.(featureId);

    // Show next discovery after a delay
    setTimeout(() => {
      const remaining = queue.filter(d => d.featureId !== featureId);
      setQueue(remaining);
      if (remaining.length > 0) {
        setCurrentDiscovery(remaining[0]);
      }
    }, 1000);
  };

  return currentDiscovery ? <FeatureDiscovery {...currentDiscovery} /> : null;
};

// Hook for triggering feature discoveries
export const useFeatureDiscovery = () => {
  const triggerDiscovery = (discovery: Omit<FeatureDiscoveryProps, 'onDismiss'>) => {
    // This would typically be handled by a global state manager
    // For now, we'll use a custom event
    const event = new CustomEvent('feature-discovery', { detail: discovery });
    window.dispatchEvent(event);
  };

  const markAsDiscovered = (featureId: string) => {
    const discoveredFeatures = JSON.parse(localStorage.getItem('discovered-features') || '[]');
    if (!discoveredFeatures.includes(featureId)) {
      discoveredFeatures.push(featureId);
      localStorage.setItem('discovered-features', JSON.stringify(discoveredFeatures));
    }
  };

  const resetAllDiscoveries = () => {
    localStorage.removeItem('discovered-features');
  };

  return {
    triggerDiscovery,
    markAsDiscovered,
    resetAllDiscoveries
  };
};
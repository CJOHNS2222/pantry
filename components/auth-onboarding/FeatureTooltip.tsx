import React, { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';

interface FeatureTooltipProps {
  target: string; // CSS selector for the element to attach to
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  featureKey: string; // Unique key to track if user has seen this tooltip
  delay?: number; // Delay before showing tooltip
  onDismiss?: () => void;
}

export const FeatureTooltip: React.FC<FeatureTooltipProps> = ({
  target,
  title,
  description,
  position = 'top',
  featureKey,
  delay = 1000,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Check if user has already seen this tooltip
    const seenTooltips = localStorage.getItem('seen-feature-tooltips') || '';
    if (seenTooltips.includes(featureKey)) {
      return;
    }

    // Find target element
    const targetElement = document.querySelector(target);
    if (!targetElement) return;

    const showTooltip = () => {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
      setIsVisible(true);
    };

    const timeoutId = setTimeout(showTooltip, delay);

    return () => clearTimeout(timeoutId);
  }, [target, featureKey, delay]);

  const handleDismiss = () => {
    setIsVisible(false);

    // Mark as seen
    const seenTooltips = localStorage.getItem('seen-feature-tooltips') || '';
    const updated = seenTooltips ? `${seenTooltips},${featureKey}` : featureKey;
    localStorage.setItem('seen-feature-tooltips', updated);

    onDismiss?.();
  };

  if (!isVisible || !targetRect) return null;

  const getTooltipPosition = () => {
    const offset = 10;
    switch (position) {
      case 'top':
        return {
          top: targetRect.top - offset,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: targetRect.bottom + offset,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - offset,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + offset,
          transform: 'translate(0, -50%)',
        };
      default:
        return {};
    }
  };

  return (
    <div
      className="fixed z-50 animate-fade-in"
      style={getTooltipPosition()}
    >
      <div className="bg-theme-secondary border border-theme rounded-lg shadow-xl p-4 max-w-xs relative">
        {/* Arrow */}
        <div
          className={`absolute w-0 h-0 border-4 border-transparent ${
            position === 'top' ? 'border-t-theme-secondary top-full left-1/2 transform -translate-x-1/2' :
            position === 'bottom' ? 'border-b-theme-secondary bottom-full left-1/2 transform -translate-x-1/2' :
            position === 'left' ? 'border-l-theme-secondary left-full top-1/2 transform -translate-y-1/2' :
            'border-r-theme-secondary right-full top-1/2 transform -translate-y-1/2'
          }`}
          style={{
            [position === 'top' ? 'borderTopColor' :
             position === 'bottom' ? 'borderBottomColor' :
             position === 'left' ? 'borderLeftColor' : 'borderRightColor']:
              'var(--bg-theme-secondary)'
          }}
        />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-theme-primary text-sm mb-1">
              {title}
            </h4>
            <p className="text-theme-secondary text-xs leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to manage feature tooltips
export const useFeatureTooltips = () => {
  const [activeTooltips, setActiveTooltips] = useState<string[]>([]);

  const showTooltip = (featureKey: string) => {
    setActiveTooltips(prev => [...prev, featureKey]);
  };

  const hideTooltip = (featureKey: string) => {
    setActiveTooltips(prev => prev.filter(key => key !== featureKey));
  };

  const hasSeenTooltip = (featureKey: string) => {
    const seenTooltips = localStorage.getItem('seen-feature-tooltips') || '';
    return seenTooltips.includes(featureKey);
  };

  return {
    activeTooltips,
    showTooltip,
    hideTooltip,
    hasSeenTooltip
  };
};
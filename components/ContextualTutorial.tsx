import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, Lightbulb, Sparkles, Target } from 'lucide-react';

interface ContextualTipProps {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right';
  targetElement?: string; // CSS selector for the element to highlight
  onDismiss: (tipId: string) => void;
  onAction?: () => void;
  actionLabel?: string;
  autoHideDelay?: number; // Auto-hide after this many ms
}

export const ContextualTip: React.FC<ContextualTipProps> = ({
  id,
  title,
  description,
  icon = <Lightbulb className="w-4 h-4" />,
  position = 'bottom',
  targetElement,
  onDismiss,
  onAction,
  actionLabel,
  autoHideDelay
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: number | undefined;

    if (targetElement) {
      const element = document.querySelector(targetElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    }

    if (autoHideDelay) {
      timer = window.setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [targetElement, autoHideDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(id), 300); // Wait for animation
  };

  const getTipPosition = () => {
    if (!targetRect) return {};

    const tipHeight = 120; // Approximate tip height
    const tipWidth = 280; // Approximate tip width

    switch (position) {
      case 'top':
        return {
          top: targetRect.top - tipHeight - 10,
          left: targetRect.left + (targetRect.width / 2) - (tipWidth / 2),
        };
      case 'bottom':
        return {
          top: targetRect.bottom + 10,
          left: targetRect.left + (targetRect.width / 2) - (tipWidth / 2),
        };
      case 'left':
        return {
          top: targetRect.top + (targetRect.height / 2) - (tipHeight / 2),
          left: targetRect.left - tipWidth - 10,
        };
      case 'right':
        return {
          top: targetRect.top + (targetRect.height / 2) - (tipHeight / 2),
          left: targetRect.right + 10,
        };
      default:
        return {};
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop highlight */}
      {targetElement && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div
            className="absolute border-2 border-[var(--accent-color)] rounded-lg shadow-lg animate-pulse"
            style={{
              top: targetRect?.top,
              left: targetRect?.left,
              width: targetRect?.width,
              height: targetRect?.height,
            }}
          />
        </div>
      )}

      {/* Tip */}
      <div
        ref={tipRef}
        className={`fixed z-50 w-72 bg-theme-secondary rounded-xl shadow-2xl border border-theme p-4 transform transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={getTipPosition()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--accent-color)]/10 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <h3 className="font-semibold text-theme-primary text-sm">
              {title}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-theme/10 text-theme-secondary/60 hover:text-theme-secondary transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-theme-secondary mb-4 leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          {onAction && actionLabel && (
            <button
              onClick={() => {
                onAction();
                handleDismiss();
              }}
              className="flex-1 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {actionLabel}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-theme-secondary hover:text-theme-primary text-sm transition-colors"
          >
            Got it
          </button>
        </div>

        {/* Arrow pointer */}
        <div
          className={`absolute w-3 h-3 bg-theme-secondary border-theme transform rotate-45 ${
            position === 'top' ? 'bottom-[-6px] border-b border-r' :
            position === 'bottom' ? 'top-[-6px] border-t border-l' :
            position === 'left' ? 'right-[-6px] border-r border-t' :
            'left-[-6px] border-l border-b'
          }`}
          style={{
            left: position === 'top' || position === 'bottom' ? '50%' : undefined,
            top: position === 'left' || position === 'right' ? '50%' : undefined,
            marginLeft: position === 'top' || position === 'bottom' ? '-6px' : undefined,
            marginTop: position === 'left' || position === 'right' ? '-6px' : undefined,
          }}
        />
      </div>
    </>
  );
};

interface ContextualTutorialProps {
  tips: ContextualTipProps[];
  onTipDismiss: (tipId: string) => void;
  maxConcurrentTips?: number;
}

export const ContextualTutorial: React.FC<ContextualTutorialProps> = ({
  tips,
  onTipDismiss,
  maxConcurrentTips = 1
}) => {
  const [activeTips, setActiveTips] = useState<ContextualTipProps[]>([]);

  useEffect(() => {
    // Show tips one at a time or up to maxConcurrentTips
    const availableTips = tips.filter(tip => !activeTips.some(active => active.id === tip.id));
    const tipsToShow = availableTips.slice(0, maxConcurrentTips - activeTips.length);

    if (tipsToShow.length > 0) {
      setActiveTips(prev => [...prev, ...tipsToShow]);
    }
  }, [tips, activeTips, maxConcurrentTips]);

  const handleTipDismiss = (tipId: string) => {
    setActiveTips(prev => prev.filter(tip => tip.id !== tipId));
    onTipDismiss(tipId);
  };

  return (
    <>
      {activeTips.map(tip => (
        <ContextualTip
          key={tip.id}
          {...tip}
          onDismiss={handleTipDismiss}
        />
      ))}
    </>
  );
};

// Hook for managing contextual tips
export const useContextualTips = () => {
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('dismissed-tutorial-tips');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const [tips, setTips] = useState<ContextualTipProps[]>([]);

  const addTip = (tip: Omit<ContextualTipProps, 'onDismiss'>) => {
    if (dismissedTips.has(tip.id)) return;

    setTips(prev => {
      // Don't add if already exists
      if (prev.some(existing => existing.id === tip.id)) return prev;
      return [...prev, { ...tip, onDismiss: () => {} }];
    });
  };

  const dismissTip = (tipId: string) => {
    setDismissedTips(prev => new Set([...prev, tipId]));
    setTips(prev => prev.filter(tip => tip.id !== tipId));
    localStorage.setItem('dismissed-tutorial-tips', JSON.stringify([...dismissedTips, tipId]));
  };

  const clearAllTips = () => {
    setTips([]);
  };

  return {
    tips,
    addTip,
    dismissTip,
    clearAllTips,
    hasDismissed: (tipId: string) => dismissedTips.has(tipId)
  };
};
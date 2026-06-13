// components/ExpirationDatePicker.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExpirationDatePickerProps {
  value: string;
  type: 'best-by' | 'use-by';
  onChange: (date: string, type: 'best-by' | 'use-by') => void;
  itemName?: string;
  category?: string; // Used to pre-select the right chip
  className?: string;
}

// Category → best default chip index (0-based)
const CATEGORY_DEFAULTS: Record<string, number> = {
  dairy: 1,      // 1 week
  produce: 0,    // 3 days
  meat: 0,       // 3 days
  seafood: 0,    // 3 days
  bread: 1,      // 1 week
  beverage: 2,   // 2 weeks
  frozen: 4,     // 3 months
  canned: 5,     // 1 year
  spices: 6,     // No expiry
  condiments: 4, // 3 months
  snacks: 2,     // 2 weeks
};

const QUICK_OPTIONS = [
  { label: '3 days',  days: 3,   color: 'red'    },
  { label: '1 week',  days: 7,   color: 'orange' },
  { label: '2 weeks', days: 14,  color: 'yellow' },
  { label: '1 month', days: 30,  color: 'green'  },
  { label: '3 months',days: 90,  color: 'green'  },
  { label: '1 year',  days: 365, color: 'green'  },
  { label: 'No expiry', days: -1, color: 'gray'  },
] as const;

const CHIP_STYLES: Record<string, string> = {
  red:    'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20',
  green:  'bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20',
  gray:   'bg-theme-secondary text-theme-secondary border-theme hover:bg-theme-primary',
};

const CHIP_ACTIVE_STYLES: Record<string, string> = {
  red:    'bg-red-500 text-white border-red-500 shadow-sm shadow-red-500/30',
  orange: 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30',
  yellow: 'bg-yellow-500 text-white border-yellow-500',
  green:  'bg-green-500 text-white border-green-500 shadow-sm shadow-green-500/30',
  gray:   'bg-theme-secondary text-theme-primary border-theme font-bold',
};

const ExpirationDatePicker: React.FC<ExpirationDatePickerProps> = ({
  value,
  type,
  onChange,
  itemName = '',
  category = '',
  className = ''
}) => {
  const [showCustom, setShowCustom] = useState(false);

  // Determine which chip is "active" based on current value
  const getActiveChip = (): number => {
    if (!value) return -1;
    const daysUntil = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
    if (daysUntil <= 0) return -1;
    // Find the closest matching option
    const idx = QUICK_OPTIONS.findIndex((opt, i) => {
      if (opt.days === -1) return false;
      const next = QUICK_OPTIONS[i + 1];
      if (!next || next.days === -1) return daysUntil >= opt.days * 0.7;
      return daysUntil <= next.days * 0.7;
    });
    return idx;
  };

  const activeChip = getActiveChip();
  const isNoExpiry = !value;

  // Pre-select chip from category on first render
  useEffect(() => {
    if (!value && category) {
      const key = category.toLowerCase();
      const matched = Object.keys(CATEGORY_DEFAULTS).find(k => key.includes(k));
      if (matched !== undefined) {
        const chipIdx = CATEGORY_DEFAULTS[matched];
        const opt = QUICK_OPTIONS[chipIdx];
        if (opt && opt.days > 0) {
          const date = new Date();
          date.setDate(date.getDate() + opt.days);
          onChange(date.toISOString().split('T')[0], type);
        }
      }
    }
  }, [category]);

  const handleChip = (days: number) => {
    if (days === -1) {
      onChange('', type);
      setShowCustom(false);
      return;
    }
    const date = new Date();
    date.setDate(date.getDate() + days);
    onChange(date.toISOString().split('T')[0], type);
    setShowCustom(false);
  };

  const getExpirationStatus = () => {
    if (!value) return null;
    const daysUntil = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
    if (daysUntil < 0) return { text: 'Expired!', color: 'text-red-500', bg: 'bg-red-500/10', Icon: AlertTriangle };
    if (daysUntil <= 3) return { text: `Expires in ${daysUntil}d — use soon!`, color: 'text-red-500', bg: 'bg-red-500/10', Icon: AlertTriangle };
    if (daysUntil <= 7) return { text: `Expires in ${daysUntil}d`, color: 'text-yellow-600', bg: 'bg-yellow-500/10', Icon: Clock };
    const dateStr = new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return { text: `${dateStr} (${type})`, color: 'text-green-600', bg: 'bg-green-500/10', Icon: CheckCircle };
  };

  const status = getExpirationStatus();

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-theme-primary">
          <Calendar className="w-3.5 h-3.5 text-[var(--accent-color)]" />
          Expiration
        </div>
        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-theme text-xs">
          {(['best-by', 'use-by'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(value, t)}
              className={`px-2 py-0.5 capitalize transition-colors ${
                type === t
                  ? 'bg-[var(--accent-color)] text-white font-semibold'
                  : 'bg-theme-secondary text-theme-secondary hover:bg-theme-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Quick chips — primary interaction */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_OPTIONS.map((opt, i) => {
          const isActive = opt.days === -1 ? isNoExpiry : activeChip === i;
          const style = isActive ? CHIP_ACTIVE_STYLES[opt.color] : CHIP_STYLES[opt.color];
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleChip(opt.days)}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${style}`}
            >
              {opt.label}
            </button>
          );
        })}
        {/* Custom date toggle */}
        <button
          type="button"
          onClick={() => setShowCustom(v => !v)}
          className="px-2.5 py-1 rounded-full border border-theme bg-theme-secondary text-theme-secondary text-xs font-medium hover:bg-theme-primary transition-colors"
        >
          {showCustom ? 'Hide' : 'Custom'}
        </button>
      </div>

      {/* Custom date input — revealed on demand */}
      {showCustom && (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value, type)}
          className="w-full px-3 py-2 text-sm border border-theme rounded-xl bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] transition-all"
        />
      )}

      {/* Status badge */}
      {value && status && (
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${status.bg} ${status.color}`}>
          <status.Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{status.text}</span>
        </div>
      )}

      {/* "Best By" / "Use By" explainer */}
      {itemName && (
        <p className="text-xs text-theme-secondary opacity-60">
          <strong>Best By</strong> = quality date &nbsp;·&nbsp; <strong>Use By</strong> = safety date
        </p>
      )}
    </div>
  );
};

export default ExpirationDatePicker;
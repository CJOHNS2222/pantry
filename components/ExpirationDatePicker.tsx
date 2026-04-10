// components/ExpirationDatePicker.tsx
import React, { useState } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ExpirationDatePickerProps {
  value: string;
  type: 'best-by' | 'use-by';
  onChange: (date: string, type: 'best-by' | 'use-by') => void;
  itemName?: string;
  className?: string;
}

const ExpirationDatePicker: React.FC<ExpirationDatePickerProps> = ({
  value,
  type,
  onChange,
  itemName = '',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Quick date options
  const quickOptions = [
    { label: '1 week', days: 7, icon: '⚡', color: 'text-red-600' },
    { label: '2 weeks', days: 14, icon: '🟡', color: 'text-yellow-600' },
    { label: '1 month', days: 30, icon: '🟢', color: 'text-green-600' },
    { label: '3 months', days: 90, icon: '🟢', color: 'text-green-600' },
    { label: '6 months', days: 180, icon: '🟢', color: 'text-green-600' },
    { label: '1 year', days: 365, icon: '🟢', color: 'text-green-600' },
  ];

  const handleQuickSelect = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    onChange(date.toISOString().split('T')[0], type);
    setIsOpen(false);
  };

  const handleCustomDate = (dateValue: string) => {
    onChange(dateValue, type);
  };

  const handleTypeChange = (newType: 'best-by' | 'use-by') => {
    onChange(value, newType);
  };

  const getExpirationStatus = () => {
    if (!value) return null;

    const daysUntil = Math.ceil((new Date(value).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { status: 'expired', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (daysUntil <= 3) return { status: 'urgent', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (daysUntil <= 7) return { status: 'soon', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock };
    return { status: 'fresh', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle };
  };

  const status = getExpirationStatus();

  return (
    <div className={`relative ${className}`}>
      {/* Current Value Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-theme-secondary" />
          <span className="text-sm font-medium text-theme-primary">Expiration</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-[var(--accent-color)] hover:text-[var(--accent-color)]/80"
        >
          {value ? 'Change' : 'Set'}
        </button>
      </div>

      {/* Current Expiration Display */}
      {value && (
        <div className={`mt-2 p-2 rounded-lg border ${status?.bg || 'bg-theme-secondary'} ${status?.color || 'text-theme-primary'}`}>
          <div className="flex items-center gap-2">
            {status?.icon && <status.icon className="w-4 h-4" />}
            <div>
              <span className="text-sm font-medium">
                {new Date(value).toLocaleDateString()} ({type})
              </span>
              {status && (
                <p className="text-xs opacity-75">
                  {status.status === 'expired' && 'Expired!'}
                  {status.status === 'urgent' && 'Expires soon!'}
                  {status.status === 'soon' && 'Expires this week'}
                  {status.status === 'fresh' && 'Fresh and good'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Picker Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-theme-primary border border-theme rounded-lg shadow-lg p-4">
          {/* Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-theme-primary mb-2">Expiration Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleTypeChange('best-by')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  type === 'best-by'
                    ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                    : 'bg-theme-secondary text-theme-primary border-theme hover:bg-theme-primary'
                }`}
              >
                Best By
                <div className="text-xs opacity-75">Quality may decline</div>
              </button>
              <button
                onClick={() => handleTypeChange('use-by')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  type === 'use-by'
                    ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                    : 'bg-theme-secondary text-theme-primary border-theme hover:bg-theme-primary'
                }`}
              >
                Use By
                <div className="text-xs opacity-75">Safety date</div>
              </button>
            </div>
          </div>

          {/* Date label explainer */}
          <details className="mb-4 rounded-lg border border-theme overflow-hidden text-xs text-theme-secondary">
            <summary className="px-3 py-2 cursor-pointer font-medium hover:bg-theme-secondary select-none">
              What do these mean?
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-1 bg-theme-secondary/30">
              <p><strong>Best By</strong> — quality date; food is safe after this date but may lose freshness.</p>
              <p><strong>Use By</strong> — manufacturer's safety/quality cutoff; triggers earlier alerts in the app.</p>
              <p><strong>Sell By</strong> — store stocking date only; enter the best-by or use-by date from the label instead.</p>
            </div>
          </details>

          {/* Quick Options */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-theme-primary mb-2">Quick Set</label>
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((option) => (
                <button
                  key={option.days}
                  onClick={() => handleQuickSelect(option.days)}
                  className="flex items-center gap-2 p-2 text-sm bg-theme-secondary rounded-lg hover:bg-theme-primary transition-colors"
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Picker */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-2">Custom Date</label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleCustomDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-theme-primary text-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            />
          </div>

          {/* Close Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm bg-theme-secondary text-theme-primary rounded-lg hover:bg-theme-primary transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpirationDatePicker;
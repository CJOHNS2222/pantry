import React, { useMemo, useEffect } from 'react';
import { PantryItem } from '../types';
import { TrendingUp, Package, Flame, AlertTriangle } from 'lucide-react';
import AnalyticsService from '../services/analyticsService';

interface PantryAnalyticsProps {
  inventory: PantryItem[];
}

export const PantryAnalytics: React.FC<PantryAnalyticsProps> = ({ inventory }) => {  // Track analytics view
  useEffect(() => {
    AnalyticsService.trackAnalyticsView('pantry_overview');
  }, []);  // Chart Colors

  // Items by Category
  const categoryData = useMemo(() => {
    const grouped = inventory.reduce((acc, item) => {
      const cat = item.category || 'Uncategorized';
      const existing = acc.find(c => c.name === cat);
      if (existing) existing.value += 1;
      else acc.push({ name: cat, value: 1 });
      return acc;
    }, [] as { name: string; value: number }[]);
    return grouped.sort((a, b) => b.value - a.value);
  }, [inventory]);

  // Items by Storage Location
  const storageData = useMemo(() => {
    const grouped = inventory.reduce((acc, item) => {
      const storage = item.storageLocation || 'Not Specified';
      const existing = acc.find(s => s.name === storage);
      if (existing) existing.value += 1;
      else acc.push({ name: storage, value: 1 });
      return acc;
    }, [] as { name: string; value: number }[]);
    return grouped.sort((a, b) => b.value - a.value);
  }, [inventory]);

  // Expiration Trend
  const expirationData = useMemo(() => {
    const now = new Date();
    const timeline = [
      { range: 'Expired', min: -Infinity, max: 0, count: 0 },
      { range: '1-7 days', min: 1, max: 7, count: 0 },
      { range: '1-2 weeks', min: 8, max: 14, count: 0 },
      { range: '2-4 weeks', min: 15, max: 28, count: 0 },
      { range: '1+ month', min: 29, max: Infinity, count: 0 }
    ];

    inventory.forEach(item => {
      const dateStr = item.expiryDate || item.expirationDate || item.expiryDate;
      if (!dateStr) return;
      const expiry = new Date(dateStr);
      const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const bucket = timeline.find(t => daysUntil >= t.min && daysUntil <= t.max);
      if (bucket) bucket.count++;
    });

    return timeline.map(t => ({ name: t.range, value: t.count }));
  }, [inventory]);

  // Usage Frequency (based on quantity - lower quantity = more used)
  const usageData = useMemo(() => {
    const toNumber = (q: unknown): number => {
      if (q == null) return 0;
      if (typeof q === 'number') return q;
      if (typeof q === 'object' && q !== null && typeof (q as { amount?: number }).amount === 'number') return (q as { amount?: number }).amount as number;
      return 0;
    };

    const sorted = [...inventory]
      .map(item => ({
        name: item.item.substring(0, 15),
        quantity: toNumber(item.quantity),
        fullName: item.item,
        rawQuantity: item.quantity
      }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10);

    return sorted;
  }, [inventory]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const expired = inventory.filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) < now;
    }).length;

    const expiringSoon = inventory.filter(item => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 7;
    }).length;

    const noExpiry = inventory.filter(item => !item.expiryDate).length;

    return { expired, expiringSoon, noExpiry, total: inventory.length };
  }, [inventory]);

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold text-theme-secondary">Pantry Analytics</h2>
        <p className="text-theme-secondary opacity-60 text-sm mt-1">Insights about your inventory</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Total Items</span>
          </div>
          <div className="text-2xl font-bold text-[var(--accent-color)]">{stats.total}</div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Expired</span>
          </div>
          <div className="text-2xl font-bold text-red-500">{stats.expired}</div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Expiring Soon</span>
          </div>
          <div className="text-2xl font-bold text-orange-500">{stats.expiringSoon}</div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">No Expiry</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{stats.noExpiry}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items by Category */}
        {categoryData.length > 0 && (
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
            <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4">Items by Category</h3>
            <div className="space-y-3">
              {categoryData.map((cat, idx) => {
                const maxValue = Math.max(...categoryData.map(c => c.value));
                const percentage = (cat.value / maxValue) * 100;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-theme-primary font-medium">{cat.name}</span>
                      <span className="text-theme-secondary opacity-70">{cat.value}</span>
                    </div>
                    <div className="w-full bg-theme-primary rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent-color)] transition-all duration-300" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items by Storage Location */}
        {storageData.length > 0 && (
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
            <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4">Storage Distribution</h3>
            <div className="space-y-3">
              {storageData.map((storage, idx) => {
                const COLORS_SIMPLE = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
                const percentage = (storage.value / stats.total) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS_SIMPLE[idx % COLORS_SIMPLE.length] }}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-theme-primary font-medium">{storage.name}</span>
                        <span className="text-theme-secondary opacity-70">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-theme-primary rounded-full h-2">
                        <div 
                          className="h-full rounded-full transition-all duration-300" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: COLORS_SIMPLE[idx % COLORS_SIMPLE.length]
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expiration Timeline */}
        {expirationData.some(d => d.value > 0) && (
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
            <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4">Expiration Timeline</h3>
            <div className="space-y-3">
              {expirationData.map((exp, idx) => {
                const maxExp = Math.max(...expirationData.map(e => e.value));
                const percentage = maxExp > 0 ? (exp.value / maxExp) * 100 : 0;
                const colors = ['#FF6B6B', '#FFA07A', '#FFD700', '#90EE90', '#98FB98'];
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-theme-primary font-medium">{exp.name}</span>
                      <span className="text-theme-secondary opacity-70">{exp.value}</span>
                    </div>
                    <div className="w-full bg-theme-primary rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300" 
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: colors[idx]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Items by Quantity (Usage Proxy) */}
        {usageData.length > 0 && (
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
            <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4">Low Stock Items</h3>
            <div className="space-y-2">
              {usageData.map((item, idx) => {
                const maxQty = Math.max(...usageData.map(u => u.quantity));
                const percentage = maxQty > 0 ? (item.quantity / maxQty) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-theme-primary font-medium truncate" title={item.fullName}>{item.name}</span>
                      <span className="text-theme-secondary opacity-70 ml-2 flex-shrink-0">{typeof item.rawQuantity === 'number' ? item.rawQuantity : (item.rawQuantity && (item.rawQuantity.amount ? `${item.rawQuantity.amount} ${item.rawQuantity.unit}` : String(item.rawQuantity)))}</span>
                    </div>
                    <div className="w-full bg-theme-primary rounded-full h-2">
                      <div 
                        className="h-full bg-[var(--accent-color)] transition-all duration-300" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary Insights */}
      <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
        <h3 className="text-lg font-bold text-[var(--accent-color)] mb-3">Insights</h3>
        <div className="space-y-2 text-sm text-theme-secondary">
          {stats.expired > 0 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              You have <span className="font-bold">{stats.expired}</span> expired items. Consider removing them.
            </p>
          )}
          {stats.expiringSoon > 0 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="font-bold">{stats.expiringSoon}</span> items are expiring within the next week.
            </p>
          )}
          {categoryData.length > 0 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Your largest category is <span className="font-bold">{categoryData[0].name}</span> with {categoryData[0].value} items.
            </p>
          )}
          {stats.noExpiry > 0 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              You have <span className="font-bold">{stats.noExpiry}</span> items without expiration dates (likely staples).
            </p>
          )}
          {inventory.length === 0 && (
            <p className="text-theme-secondary opacity-70">No items in pantry yet. Start adding items to see analytics!</p>
          )}
        </div>
      </div>
    </div>
  );
};

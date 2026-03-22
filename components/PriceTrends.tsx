import React, { useState, useEffect } from 'react';
import { groceryPriceService } from '../services/groceryPriceService';
import { PriceTrend } from '../types/app';
import { log } from '../services/logService';

interface PriceTrendsProps {
  ingredient: string;
  onClose: () => void;
}

const PriceTrends: React.FC<PriceTrendsProps> = ({ ingredient, onClose }) => {
  const [trends, setTrends] = useState<PriceTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true);
        const trendData = await groceryPriceService.getPriceTrendAnalysis(ingredient);
        setTrends(trendData);
      } catch (err) {
        log.error('Error loading price trends', { error: err }, 'PriceTrends');
        setError('Failed to load price trends');
      } finally {
        setLoading(false);
      }
    };

    loadTrends();
  }, [ingredient]);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || isNaN(price)) return '$0.00';
    return `$${price.toFixed(2)}`;
  };
  const formatDate = (date: Date) => date.toLocaleDateString();

  const getTrendIcon = (change: number) => {
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-red-600';
    if (change < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading price trends...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trends) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Price Trends</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700" data-testid="pricetrends-close">✕</button>
          </div>
          <p className="text-red-600">{error || 'No trend data available'}</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Price Trends for {ingredient}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" data-testid="pricetrends-close">✕</button>
        </div>

        <div className="space-y-4">
          {/* Current Price */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Current Price</h4>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatPrice(trends.currentPrice)}</span>
              <span className="text-sm text-gray-500">
                Last updated: {formatDate(trends.lastUpdated)}
              </span>
            </div>
          </div>

          {/* Price Change */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Price Change</h4>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getTrendIcon(trends.priceChange)}</span>
              <div>
                <span className={`text-xl font-bold ${getTrendColor(trends.priceChange)}`}>
                  {trends.priceChange > 0 ? '+' : ''}{formatPrice(trends.priceChange)}
                </span>
                <p className="text-sm text-gray-600">
                  {trends.priceChangePercent > 0 ? '+' : ''}{trends.priceChangePercent.toFixed(1)}% from last month
                </p>
              </div>
            </div>
          </div>

          {/* Price History */}
          {trends.priceHistory && trends.priceHistory.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Recent Price History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {trends.priceHistory.slice(-10).map((entry, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{formatDate(entry.date)}</span>
                    <span className="font-medium">{formatPrice(entry.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend Analysis */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Trend Analysis</h4>
            <p className="text-sm text-gray-700">
              {trends.priceChange > 0.1
                ? `Prices are trending upward. Consider buying now if you need ${ingredient} soon.`
                : trends.priceChange < -0.1
                ? `Prices are trending downward. This might be a good time to stock up on ${ingredient}.`
                : `Prices are relatively stable. No significant trend detected.`}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          data-testid="pricetrends-close"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PriceTrends;
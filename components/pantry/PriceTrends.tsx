import React, { useState, useEffect } from 'react';
import { groceryPriceService } from '../../services/groceryPriceService';
import { PriceTrend } from '../../types/app';
import { log } from '../../services/logService';
import { Modal } from '../ui/Modal';

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
    if (change > 0) return 'text-red-500';
    if (change < 0) return 'text-green-500';
    return 'text-[var(--text-secondary)]';
  };

  if (loading) {
    return (
      <Modal isOpen onClose={onClose} title="Price Trends" size="sm">
        <Modal.Body>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)] mx-auto"></div>
            <p className="mt-2 text-[var(--text-secondary)]">Loading price trends...</p>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  if (error || !trends) {
    return (
      <Modal isOpen onClose={onClose} title="Price Trends" size="sm">
        <Modal.Body>
          <p className="text-red-500">{error || 'No trend data available'}</p>
        </Modal.Body>
        <Modal.Footer align="between">
          <button
            onClick={onClose}
            data-testid="pricetrends-close"
            className="w-full bg-[var(--accent-color)] text-[var(--accent-text,white)] py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={`Price Trends for ${ingredient}`} size="md">
      <Modal.Body>
        <div className="space-y-4">
          {/* Current Price */}
          <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--text-primary)]">Current Price</h4>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-[var(--text-primary)]">{formatPrice(trends.currentPrice)}</span>
              <span className="text-sm text-[var(--text-secondary)]">
                Last updated: {formatDate(trends.lastUpdated)}
              </span>
            </div>
          </div>

          {/* Price Change */}
          <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--text-primary)]">Price Change</h4>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getTrendIcon(trends.priceChange)}</span>
              <div>
                <span className={`text-xl font-bold ${getTrendColor(trends.priceChange)}`}>
                  {trends.priceChange > 0 ? '+' : ''}{formatPrice(trends.priceChange)}
                </span>
                <p className="text-sm text-[var(--text-secondary)]">
                  {trends.priceChangePercent > 0 ? '+' : ''}{trends.priceChangePercent.toFixed(1)}% from last month
                </p>
              </div>
            </div>
          </div>

          {/* Price History */}
          {trends.priceHistory && trends.priceHistory.length > 0 && (
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-[var(--text-primary)]">Recent Price History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {trends.priceHistory.slice(-10).map((entry, index) => (
                  <div key={index} className="flex justify-between text-sm text-[var(--text-primary)]">
                    <span>{formatDate(entry.date)}</span>
                    <span className="font-medium">{formatPrice(entry.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend Analysis */}
          <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--text-primary)]">Trend Analysis</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              {trends.priceChange > 0.1
                ? `Prices are trending upward. Consider buying now if you need ${ingredient} soon.`
                : trends.priceChange < -0.1
                ? `Prices are trending downward. This might be a good time to stock up on ${ingredient}.`
                : `Prices are relatively stable. No significant trend detected.`}
            </p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer align="between">
        <button
          onClick={onClose}
          data-testid="pricetrends-close"
          className="w-full bg-[var(--accent-color)] text-[var(--accent-text,white)] py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default PriceTrends;

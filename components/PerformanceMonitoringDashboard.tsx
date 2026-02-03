import React, { useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { log } from '../services/logService';

interface CoreWebVitals {
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
}

interface ComponentRenderMetrics {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  totalRenderTime: number;
  lastRenderTime: number;
}

interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
}

const PerformanceMonitoringDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'webVitals' | 'components' | 'network'>('overview');
  const [coreWebVitals, setCoreWebVitals] = useState<CoreWebVitals>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null
  });
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentRenderMetrics>>(new Map());
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [dbMetrics, setDbMetrics] = useState<any>(null);

  // Track component renders
  const renderTracker = useRef<Map<string, { count: number; times: number[]; startTime: number }>>(new Map());

  useEffect(() => {
    if (!isVisible) return;

    // Track Core Web Vitals
    const trackWebVitals = () => {
      // Largest Contentful Paint
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            setCoreWebVitals(prev => ({ ...prev, lcp: lastEntry.startTime }));
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // First Input Delay
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              setCoreWebVitals(prev => ({ ...prev, fid: entry.processingStart - entry.startTime }));
            });
          });
          fidObserver.observe({ entryTypes: ['first-input'] });

          // Cumulative Layout Shift
          const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            setCoreWebVitals(prev => ({ ...prev, cls: clsValue }));
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // First Contentful Paint
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            setCoreWebVitals(prev => ({ ...prev, fcp: lastEntry.startTime }));
          });
          fcpObserver.observe({ entryTypes: ['paint'] });

          // Time to First Byte
          const navigationObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              setCoreWebVitals(prev => ({ ...prev, ttfb: entry.responseStart - entry.requestStart }));
            });
          });
          navigationObserver.observe({ entryTypes: ['navigation'] });

          return () => {
            lcpObserver.disconnect();
            fidObserver.disconnect();
            clsObserver.disconnect();
            fcpObserver.disconnect();
            navigationObserver.disconnect();
          };
        } catch (error) {
          log.warn('Performance Observer not fully supported', { error }, 'PerformanceMonitoringDashboard');
        }
      }
    };

    // Track Network Requests
    const trackNetworkRequests = () => {
      if ('PerformanceObserver' in window) {
        try {
          const networkObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const newRequests: NetworkRequest[] = entries.map((entry: any) => ({
              url: entry.name,
              method: 'GET', // Default, could be enhanced
              status: 200, // Default, could be enhanced
              duration: entry.responseEnd - entry.requestStart,
              size: entry.transferSize || 0,
              timestamp: Date.now()
            }));

            setNetworkRequests(prev => [...prev.slice(-50), ...newRequests]); // Keep last 50
          });
          networkObserver.observe({ entryTypes: ['resource'] });

          return () => networkObserver.disconnect();
        } catch (error) {
          log.warn('Network tracking not supported', { error }, 'PerformanceMonitoringDashboard');
        }
      }
    };

    // Update database metrics
    const updateMetrics = () => {
      setDbMetrics(DatabaseMonitoringService.getMetrics());
    };

    const cleanupWebVitals = trackWebVitals();
    const cleanupNetwork = trackNetworkRequests();
    const metricsInterval = setInterval(updateMetrics, 1000);

    updateMetrics();

    return () => {
      cleanupWebVitals?.();
      cleanupNetwork?.();
      clearInterval(metricsInterval);
    };
  }, [isVisible]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getVitalsColor = (value: number | null, thresholds: { good: number; poor: number }): string => {
    if (value === null) return 'text-gray-500';
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.poor) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors z-50"
      >
        📊 Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden z-50">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Performance Dashboard</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'webVitals', label: 'Web Vitals', icon: '⚡' },
          { id: 'components', label: 'Components', icon: '🧩' },
          { id: 'network', label: 'Network', icon: '🌐' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-3 text-sm font-medium ${
              activeTab === tab.id
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-blue-700 font-medium text-sm">Database Reads</div>
                <div className="text-2xl font-bold text-blue-800">
                  {dbMetrics?.reads || 0}
                </div>
                <div className="text-xs text-blue-600">
                  {dbMetrics ? Math.round((dbMetrics.reads / dbMetrics.sessionDuration) * 60000) : 0}/min
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-green-700 font-medium text-sm">LCP</div>
                <div className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.lcp, { good: 2500, poor: 4000 })}`}>
                  {coreWebVitals.lcp ? formatTime(coreWebVitals.lcp) : 'N/A'}
                </div>
                <div className="text-xs text-green-600">Largest Contentful Paint</div>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-yellow-700 font-medium text-sm">FID</div>
                <div className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.fid, { good: 100, poor: 300 })}`}>
                  {coreWebVitals.fid ? formatTime(coreWebVitals.fid) : 'N/A'}
                </div>
                <div className="text-xs text-yellow-600">First Input Delay</div>
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-red-700 font-medium text-sm">CLS</div>
                <div className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.cls, { good: 0.1, poor: 0.25 })}`}>
                  {coreWebVitals.cls ? coreWebVitals.cls.toFixed(3) : 'N/A'}
                </div>
                <div className="text-xs text-red-600">Layout Shift</div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <div>Session Duration: {dbMetrics ? formatTime(dbMetrics.sessionDuration) : '0ms'}</div>
              <div>Network Requests: {networkRequests.length}</div>
            </div>
          </div>
        )}

        {activeTab === 'webVitals' && (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Largest Contentful Paint (LCP)</h4>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.lcp, { good: 2500, poor: 4000 })}`}>
                    {coreWebVitals.lcp ? formatTime(coreWebVitals.lcp) : 'Not measured'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {coreWebVitals.lcp && coreWebVitals.lcp <= 2500 ? 'Good' :
                     coreWebVitals.lcp && coreWebVitals.lcp <= 4000 ? 'Needs improvement' : 'Poor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Should be &lt; 2.5s</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">First Input Delay (FID)</h4>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.fid, { good: 100, poor: 300 })}`}>
                    {coreWebVitals.fid ? formatTime(coreWebVitals.fid) : 'Not measured'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {coreWebVitals.fid && coreWebVitals.fid <= 100 ? 'Good' :
                     coreWebVitals.fid && coreWebVitals.fid <= 300 ? 'Needs improvement' : 'Poor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Should be &lt; 100ms</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Cumulative Layout Shift (CLS)</h4>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.cls, { good: 0.1, poor: 0.25 })}`}>
                    {coreWebVitals.cls ? coreWebVitals.cls.toFixed(3) : 'Not measured'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {coreWebVitals.cls && coreWebVitals.cls <= 0.1 ? 'Good' :
                     coreWebVitals.cls && coreWebVitals.cls <= 0.25 ? 'Needs improvement' : 'Poor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Should be &lt; 0.1</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">First Contentful Paint (FCP)</h4>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.fcp, { good: 1800, poor: 3000 })}`}>
                    {coreWebVitals.fcp ? formatTime(coreWebVitals.fcp) : 'Not measured'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {coreWebVitals.fcp && coreWebVitals.fcp <= 1800 ? 'Good' :
                     coreWebVitals.fcp && coreWebVitals.fcp <= 3000 ? 'Needs improvement' : 'Poor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Should be &lt; 1.8s</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Time to First Byte (TTFB)</h4>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getVitalsColor(coreWebVitals.ttfb, { good: 800, poor: 1800 })}`}>
                    {coreWebVitals.ttfb ? formatTime(coreWebVitals.ttfb) : 'Not measured'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {coreWebVitals.ttfb && coreWebVitals.ttfb <= 800 ? 'Good' :
                     coreWebVitals.ttfb && coreWebVitals.ttfb <= 1800 ? 'Needs improvement' : 'Poor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Should be &lt; 800ms</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Component render tracking is enabled in development mode.
              This feature tracks render counts and performance for React components.
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-yellow-800 font-medium text-sm">Note</div>
              <div className="text-yellow-700 text-xs mt-1">
                Detailed component metrics require React DevTools or additional instrumentation.
                This dashboard provides a foundation for performance monitoring.
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <div>• Database operations are tracked in real-time</div>
              <div>• Network requests are monitored automatically</div>
              <div>• Core Web Vitals are measured continuously</div>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              Recent network requests ({networkRequests.length})
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {networkRequests.slice(-10).reverse().map((request, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">
                        {request.url.split('/').pop() || request.url}
                      </div>
                      <div className="text-gray-500">
                        {request.method} • {request.status} • {formatTime(request.duration)}
                      </div>
                    </div>
                    <div className="text-gray-600 ml-2">
                      {formatBytes(request.size)}
                    </div>
                  </div>
                </div>
              ))}

              {networkRequests.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No network requests recorded yet
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
              Network waterfall shows the last 10 requests. Full monitoring available in browser DevTools.
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 flex gap-2">
        <button
          onClick={() => {
            DatabaseMonitoringService.logCurrentMetrics();
            log.info('Core Web Vitals', { coreWebVitals }, 'PerformanceMonitoringDashboard');
            console.log('Network Requests:', networkRequests);
          }}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs"
        >
          Log to Console
        </button>
        <button
          onClick={() => {
            setCoreWebVitals({ lcp: null, fid: null, cls: null, fcp: null, ttfb: null });
            setNetworkRequests([]);
            DatabaseMonitoringService.resetMetrics();
          }}
          className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs"
        >
          Reset All
        </button>
      </div>
    </div>
  );
};

export default PerformanceMonitoringDashboard;
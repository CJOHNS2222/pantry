import { trackPerformanceMetric } from './sentryService';

// Performance monitoring service for Core Web Vitals and custom metrics
class PerformanceMonitoringService {
  private static observers: PerformanceObserver[] = [];
  private static marks: Map<string, number> = new Map();
  private static beforeUnloadListener: (() => void) | null = null;

  // Initialize Core Web Vitals tracking
  static init() {
    this.initCoreWebVitals();
    this.initCustomMetrics();
  }

  // Initialize Core Web Vitals tracking
  private static initCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;

          trackPerformanceMetric('lcp', lastEntry.startTime, 'ms', {
            element: lastEntry.element?.tagName,
            size: lastEntry.size
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observation not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            trackPerformanceMetric('fid', entry.processingStart - entry.startTime, 'ms', {
              event_type: entry.name,
              target: entry.target?.tagName
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observation not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);

        // Report CLS on page unload
        this.beforeUnloadListener = () => {
          trackPerformanceMetric('cls', clsValue, 'score');
        };
        window.addEventListener('beforeunload', this.beforeUnloadListener);
      } catch (e) {
        console.warn('CLS observation not supported');
      }
    }
  }

  // Initialize custom performance metrics
  private static initCustomMetrics() {
    // Track navigation timing
    if ('performance' in window && 'timing' in performance) {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;

      // Time to First Byte (TTFB)
      const ttfb = timing.responseStart - timing.requestStart;
      trackPerformanceMetric('ttfb', ttfb, 'ms');

      // DOM Content Loaded
      const domContentLoaded = timing.domContentLoadedEventEnd - navigationStart;
      trackPerformanceMetric('dom_content_loaded', domContentLoaded, 'ms');

      // Page Load Complete
      const pageLoad = timing.loadEventEnd - navigationStart;
      trackPerformanceMetric('page_load_complete', pageLoad, 'ms');
    }

    // Track resource loading performance
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.duration > 1000) { // Only track slow resources
              trackPerformanceMetric('slow_resource', entry.duration, 'ms', {
                resource_url: entry.name,
                resource_type: entry.initiatorType,
                size: entry.transferSize
              });
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource observation not supported');
      }
    }
  }

  // Custom performance marks
  static mark(name: string) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
      this.marks.set(name, performance.now());
    }
  }

  static measure(name: string, startMark?: string, endMark?: string) {
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0] as any;
        if (measure) {
          trackPerformanceMetric(name, measure.duration, 'ms', {
            start_mark: startMark,
            end_mark: endMark
          });
        }
      } catch (e) {
        console.warn(`Performance measure failed for ${name}:`, e);
      }
    }
  }

  // Track component render performance
  static trackComponentRender(componentName: string, renderTime: number) {
    trackPerformanceMetric('component_render', renderTime, 'ms', {
      component: componentName
    });
  }

  // Track database operation performance
  static trackDatabaseOperation(operation: string, duration: number, collection?: string) {
    trackPerformanceMetric('database_operation', duration, 'ms', {
      operation,
      collection
    });
  }

  // Track API call performance
  static trackApiCall(endpoint: string, duration: number, success: boolean) {
    trackPerformanceMetric('api_call', duration, 'ms', {
      endpoint,
      success
    });
  }

  // Track image loading performance
  static trackImageLoad(imageUrl: string, loadTime: number, success: boolean) {
    trackPerformanceMetric('image_load', loadTime, 'ms', {
      image_url: imageUrl,
      success
    });
  }

  // Track user interaction performance
  static trackUserInteraction(action: string, responseTime: number) {
    trackPerformanceMetric('user_interaction', responseTime, 'ms', {
      action
    });
  }

  // Memory usage tracking
  static trackMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      trackPerformanceMetric('memory_usage', memory.usedJSHeapSize / 1024 / 1024, 'MB', {
        total_heap: memory.totalJSHeapSize / 1024 / 1024,
        heap_limit: memory.jsHeapSizeLimit / 1024 / 1024
      });
    }
  }

  // Clean up observers
  static cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers = [];
    this.marks.clear();

    // Remove beforeunload listener
    if (this.beforeUnloadListener) {
      window.removeEventListener('beforeunload', this.beforeUnloadListener);
      this.beforeUnloadListener = null;
    }
  }
}

export default PerformanceMonitoringService;

import React, { useState, useEffect, useRef } from 'react';
import DatabaseMonitoringService from '../services/databaseMonitoringService';

interface DatabaseMetrics {
  reads: number;
  writes: number;
  deletes: number;
  queries: number;
  batchOperations: number;
  realtimeSubscriptions: number;
  sessionDuration: number;
}

const DatabaseAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [modalDragOffset, setModalDragOffset] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('dbAnalyticsButtonPosition');
    const savedModalPosition = localStorage.getItem('dbAnalyticsModalPosition');
    
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (error) {
        console.error('Failed to parse saved position:', error);
        setPosition({ x: 20, y: 20 });
      }
    } else {
      setPosition({ x: 20, y: 20 });
    }

    if (savedModalPosition) {
      try {
        const parsed = JSON.parse(savedModalPosition);
        setModalPosition(parsed);
      } catch (error) {
        console.error('Failed to parse saved modal position:', error);
        setModalPosition({ x: 100, y: 100 });
      }
    } else {
      setModalPosition({ x: 100, y: 100 });
    }
  }, []);

  // Load metrics when component becomes visible
  useEffect(() => {
    if (isVisible) {
      const currentMetrics = DatabaseMonitoringService.getMetrics();
      setMetrics(currentMetrics);
    }
  }, [isVisible]);

  // Update metrics every 5 seconds when visible
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const currentMetrics = DatabaseMonitoringService.getMetrics();
      setMetrics(currentMetrics);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain to viewport bounds
      const maxX = window.innerWidth - 120; // Button width + margin
      const maxY = window.innerHeight - 40; // Button height + margin
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: constrainedX, y: constrainedY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Save button position
    localStorage.setItem('dbAnalyticsButtonPosition', JSON.stringify(position));
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    setModalDragOffset({
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y
    });
    setIsDraggingModal(true);
  };

  const handleModalMouseMove = (e: MouseEvent) => {
    if (isDraggingModal) {
      const newX = e.clientX - modalDragOffset.x;
      const newY = e.clientY - modalDragOffset.y;

      // Constrain to viewport bounds
      const maxX = window.innerWidth - 320; // Modal width + margin
      const maxY = window.innerHeight - 400; // Modal height + margin
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));

      setModalPosition({ x: constrainedX, y: constrainedY });
    }
  };

  const handleModalMouseUp = () => {
    setIsDraggingModal(false);
    // Save modal position
    localStorage.setItem('dbAnalyticsModalPosition', JSON.stringify(modalPosition));
  };

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging || isDraggingModal) {
      document.addEventListener('mousemove', isDragging ? handleMouseMove : handleModalMouseMove);
      document.addEventListener('mouseup', isDragging ? handleMouseUp : handleModalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousemove', handleModalMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseup', handleModalMouseUp);
    };
  }, [isDragging, isDraggingModal, dragOffset, modalDragOffset]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const calculateRate = (count: number, durationMs: number): number => {
    const minutes = durationMs / 60000;
    return minutes > 0 ? Math.round(count / minutes) : 0;
  };

  if (!isVisible) {
    return (
      <button
        ref={buttonRef}
        onClick={() => setIsVisible(true)}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: 9999 // Make sure it's on top
        }}
        className="bg-red-600 text-white px-8 py-4 rounded-lg shadow-2xl hover:bg-red-700 transition-colors border-4 border-yellow-400 animate-pulse text-lg font-bold"
        title="Click to open Database Analytics"
      >
        📊 DB Analytics ({metrics ? `${DatabaseMonitoringService.getMetrics().reads} reads` : '...'})
      </button>
    );
  }

  return (
    <div 
      className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm z-50"
      style={{
        position: 'fixed',
        left: `${modalPosition.x}px`,
        top: `${modalPosition.y}px`,
        cursor: isDraggingModal ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="flex justify-between items-center mb-3 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleModalMouseDown}
      >
        <h3 className="text-lg font-semibold text-gray-800">Database Analytics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>
      </div>

      {metrics ? (
        <div className="space-y-2 text-sm">
          <div className="text-gray-600">
            Session: {formatDuration(metrics.sessionDuration)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 p-2 rounded">
              <div className="text-green-700 font-medium">Reads</div>
              <div className="text-xl font-bold text-green-800">{metrics.reads}</div>
              <div className="text-xs text-green-600">
                {calculateRate(metrics.reads, metrics.sessionDuration)}/min
              </div>
            </div>

            <div className="bg-blue-50 p-2 rounded">
              <div className="text-blue-700 font-medium">Writes</div>
              <div className="text-xl font-bold text-blue-800">{metrics.writes}</div>
              <div className="text-xs text-blue-600">
                {calculateRate(metrics.writes, metrics.sessionDuration)}/min
              </div>
            </div>

            <div className="bg-red-50 p-2 rounded">
              <div className="text-red-700 font-medium">Deletes</div>
              <div className="text-xl font-bold text-red-800">{metrics.deletes}</div>
            </div>

            <div className="bg-purple-50 p-2 rounded">
              <div className="text-purple-700 font-medium">Queries</div>
              <div className="text-xl font-bold text-purple-800">{metrics.queries}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Batch Ops: {metrics.batchOperations}</span>
              <span>Subscriptions: {metrics.realtimeSubscriptions}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => DatabaseMonitoringService.logCurrentMetrics()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs"
            >
              Log to Console
            </button>
            <button
              onClick={() => DatabaseMonitoringService.resetMetrics()}
              className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-4">
          Loading metrics...
        </div>
      )}
    </div>
  );
};

export default DatabaseAnalytics;
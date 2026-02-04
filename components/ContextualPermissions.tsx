import React, { useState, useEffect } from 'react';
import { Camera, Bell, MapPin, Mic, Image, X, CheckCircle, AlertCircle } from 'lucide-react';

interface PermissionRequestProps {
  permission: 'camera' | 'notifications' | 'location' | 'microphone' | 'photos';
  title: string;
  description: string;
  icon?: React.ReactNode;
  onGrant: () => void;
  onDeny: () => void;
  onDismiss?: () => void;
  triggerElement?: string; // CSS selector for the element that triggered this request
  isRequired?: boolean; // If true, user can't proceed without granting
}

export const PermissionRequest: React.FC<PermissionRequestProps> = ({
  permission,
  title,
  description,
  icon,
  onGrant,
  onDeny,
  onDismiss,
  triggerElement,
  isRequired = false
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (triggerElement) {
      const element = document.querySelector(triggerElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    }
  }, [triggerElement]);

  const getPermissionIcon = () => {
    if (icon) return icon;

    switch (permission) {
      case 'camera': return <Camera className="w-6 h-6" />;
      case 'notifications': return <Bell className="w-6 h-6" />;
      case 'location': return <MapPin className="w-6 h-6" />;
      case 'microphone': return <Mic className="w-6 h-6" />;
      case 'photos': return <Image className="w-6 h-6" />;
      default: return <AlertCircle className="w-6 h-6" />;
    }
  };

  const getPermissionColor = () => {
    switch (permission) {
      case 'camera': return 'from-blue-500 to-cyan-500';
      case 'notifications': return 'from-purple-500 to-pink-500';
      case 'location': return 'from-green-500 to-emerald-500';
      case 'microphone': return 'from-orange-500 to-red-500';
      case 'photos': return 'from-indigo-500 to-purple-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const handleGrant = async () => {
    setIsRequesting(true);
    try {
      // Here you would implement the actual permission request
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));
      onGrant();
      setIsVisible(false);
    } catch (error) {
      console.error('Permission request failed:', error);
      onDeny();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeny = () => {
    onDeny();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">

        {/* Highlight trigger element */}
        {triggerElement && targetRect && (
          <div
            className="absolute border-2 border-[var(--accent-color)] rounded-lg shadow-lg animate-pulse pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}

        {/* Permission request modal */}
        <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden">

          {/* Header gradient */}
          <div className={`h-20 bg-gradient-to-r ${getPermissionColor()} relative`}>
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-4 right-4">
              {!isRequired && (
                <button
                  onClick={handleDismiss}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 -mt-8 relative z-10">
            {/* Icon */}
            <div className={`w-16 h-16 bg-gradient-to-r ${getPermissionColor()} rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4`}>
              {getPermissionIcon()}
            </div>

            {/* Text */}
            <h2 className="text-xl font-bold text-theme-primary text-center mb-2">
              {title}
            </h2>
            <p className="text-theme-secondary text-center mb-6 leading-relaxed">
              {description}
            </p>

            {/* Benefits */}
            <div className="bg-theme/5 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-theme-primary mb-2 text-sm">
                What you'll get:
              </h3>
              <ul className="space-y-1 text-sm text-theme-secondary">
                {permission === 'camera' && (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Quick pantry scanning
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Recipe photo uploads
                    </li>
                  </>
                )}
                {permission === 'notifications' && (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Meal prep reminders
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Expiring ingredient alerts
                    </li>
                  </>
                )}
                {permission === 'location' && (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Local store suggestions
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Seasonal recipe recommendations
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleGrant}
                disabled={isRequesting}
                className={`w-full bg-gradient-to-r ${getPermissionColor()} hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${
                  isRequesting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isRequesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Requesting...
                  </>
                ) : (
                  <>
                    Allow Access
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>

              {!isRequired && (
                <button
                  onClick={handleDeny}
                  className="w-full bg-theme/10 hover:bg-theme/20 text-theme-secondary py-3 px-6 rounded-xl font-medium transition-colors"
                >
                  Not now
                </button>
              )}

              {isRequired && (
                <p className="text-xs text-theme-secondary/60 text-center">
                  This permission is required to use this feature
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

interface ContextualPermissionManagerProps {
  permissions: PermissionRequestProps[];
  onPermissionResult: (permission: string, granted: boolean) => void;
}

export const ContextualPermissionManager: React.FC<ContextualPermissionManagerProps> = ({
  permissions,
  onPermissionResult
}) => {
  const [currentRequest, setCurrentRequest] = useState<PermissionRequestProps | null>(null);
  const [queue, setQueue] = useState<PermissionRequestProps[]>([]);

  useEffect(() => {
    if (permissions.length > 0 && !currentRequest) {
      setCurrentRequest(permissions[0]);
      setQueue(permissions.slice(1));
    }
  }, [permissions, currentRequest]);

  const handleGrant = () => {
    if (currentRequest) {
      onPermissionResult(currentRequest.permission, true);
      showNextRequest();
    }
  };

  const handleDeny = () => {
    if (currentRequest) {
      onPermissionResult(currentRequest.permission, false);
      showNextRequest();
    }
  };

  const handleDismiss = () => {
    if (currentRequest) {
      onPermissionResult(currentRequest.permission, false);
      showNextRequest();
    }
  };

  const showNextRequest = () => {
    setCurrentRequest(null);
    setTimeout(() => {
      if (queue.length > 0) {
        setCurrentRequest(queue[0]);
        setQueue(queue.slice(1));
      }
    }, 300);
  };

  return currentRequest ? (
    <PermissionRequest
      {...currentRequest}
      onGrant={handleGrant}
      onDeny={handleDeny}
      onDismiss={handleDismiss}
    />
  ) : null;
};

// Hook for managing contextual permissions
export const useContextualPermissions = () => {
  const [permissionStates, setPermissionStates] = useState<Record<string, boolean>>({});
  const [pendingRequests, setPendingRequests] = useState<PermissionRequestProps[]>([]);

  const requestPermission = (request: Omit<PermissionRequestProps, 'onGrant' | 'onDeny' | 'onDismiss'>) => {
    // Check if already requested
    const key = `permission-${request.permission}`;
    const requested = localStorage.getItem(key);

    if (requested) {
      const granted = requested === 'granted';
      setPermissionStates(prev => ({ ...prev, [request.permission]: granted }));
      return Promise.resolve(granted);
    }

    return new Promise<boolean>((resolve) => {
      const fullRequest: PermissionRequestProps = {
        ...request,
        onGrant: () => {
          localStorage.setItem(key, 'granted');
          setPermissionStates(prev => ({ ...prev, [request.permission]: true }));
          resolve(true);
        },
        onDeny: () => {
          localStorage.setItem(key, 'denied');
          setPermissionStates(prev => ({ ...prev, [request.permission]: false }));
          resolve(false);
        },
        onDismiss: () => {
          // Treat dismiss as deny for now
          localStorage.setItem(key, 'denied');
          setPermissionStates(prev => ({ ...prev, [request.permission]: false }));
          resolve(false);
        }
      };

      setPendingRequests(prev => [...prev, fullRequest]);
    });
  };

  const hasPermission = (permission: string): boolean => {
    return permissionStates[permission] || false;
  };

  const clearPendingRequests = () => {
    setPendingRequests([]);
  };

  return {
    requestPermission,
    hasPermission,
    pendingRequests,
    clearPendingRequests
  };
};
import React from 'react';
import { Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { log } from '../../../services/logService';

interface CameraPermissionsModalsProps {
  showPermissionEducator: boolean;
  setShowPermissionEducator: (show: boolean) => void;
  showSettingsFallback: boolean;
  setShowSettingsFallback: (show: boolean) => void;
  pendingCameraAction: (() => Promise<void>) | null;
  setPendingCameraAction: (action: (() => Promise<void>) | null) => void;
  setIsAddModalOpen: (open: boolean) => void;
}

export const CameraPermissionsModals: React.FC<CameraPermissionsModalsProps> = ({
  showPermissionEducator,
  setShowPermissionEducator,
  showSettingsFallback,
  setShowSettingsFallback,
  pendingCameraAction,
  setPendingCameraAction,
  setIsAddModalOpen
}) => {
  return (
    <>
      {/* Camera Pre-Permission Educator Modal */}
      {showPermissionEducator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden border border-theme">
            {/* Header banner */}
            <div className="h-20 bg-gradient-to-r from-blue-500 to-cyan-500 relative flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
            {/* Content */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-theme-primary text-center mb-2">
                Camera Access Needed
              </h2>
              <p className="text-theme-secondary text-sm text-center mb-6 leading-relaxed">
                We use your camera to scan pantry item details, recognize receipt text, and check barcodes. No photos are stored on our servers.
              </p>
              
              <div className="bg-theme/5 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-theme-primary text-xs mb-2">Benefits:</h3>
                <ul className="text-xs text-theme-secondary space-y-2">
                  <li className="flex items-center gap-2">✓ Quick shelf scans</li>
                  <li className="flex items-center gap-2">✓ Automatic expiry detection</li>
                  <li className="flex items-center gap-2">✓ Instant list updates</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    setShowPermissionEducator(false);
                    try {
                      const req = await CapacitorCamera.requestPermissions();
                      if (req.camera === 'granted' && pendingCameraAction) {
                        await pendingCameraAction();
                      } else if (req.camera === 'denied') {
                        setShowSettingsFallback(true);
                      }
                    } catch (err) {
                      log.error('Permission request failed', { err }, 'CameraPermissionsModals');
                    }
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200"
                >
                  Allow Access
                </button>
                <button
                  onClick={() => {
                    setShowPermissionEducator(false);
                    setPendingCameraAction(null);
                  }}
                  className="w-full bg-theme/10 hover:bg-theme/20 text-theme-secondary py-3 px-6 rounded-xl font-medium transition-colors"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Denied Fallback Dialog */}
      {showSettingsFallback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden border border-theme">
            <div className="h-20 bg-gradient-to-r from-red-500 to-orange-500 relative flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-theme-primary text-center mb-2">
                Permission Required
              </h2>
              <p className="text-theme-secondary text-sm text-center mb-6 leading-relaxed">
                Camera access was permanently denied. Please enable camera permissions in your Android system settings to use the scanner.
              </p>
              
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-orange-800 dark:text-orange-300 text-xs mb-1">How to enable:</h3>
                <ol className="text-xs text-orange-700 dark:text-orange-400 list-decimal pl-4 space-y-1">
                  <li>Open Android Settings</li>
                  <li>Go to Apps & Notifications</li>
                  <li>Select Stock & Spoon</li>
                  <li>Tap Permissions and enable Camera</li>
                </ol>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowSettingsFallback(false);
                    setPendingCameraAction(null);
                    setIsAddModalOpen(true); // Fallback directly to manual entry
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200"
                >
                  Add Item Manually
                </button>
                <button
                  onClick={() => {
                    setShowSettingsFallback(false);
                    setPendingCameraAction(null);
                  }}
                  className="w-full bg-theme/10 hover:bg-theme/20 text-theme-secondary py-3 px-6 rounded-xl font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


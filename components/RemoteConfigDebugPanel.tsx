import React, { useMemo, useState } from 'react';
import remoteConfig from '../services/remoteConfigService';

interface RemoteConfigDebugPanelProps {
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
}

type DebugValue = string | number | boolean;

const readSnapshot = (): Record<string, DebugValue> => remoteConfig.getDebugSnapshot();

export const RemoteConfigDebugPanel: React.FC<RemoteConfigDebugPanelProps> = ({ addToast }) => {
  const [snapshot, setSnapshot] = useState<Record<string, DebugValue>>(() => readSnapshot());
  const [copied, setCopied] = useState(false);

  const sortedEntries = useMemo(
    () => Object.entries(snapshot).sort((a, b) => a[0].localeCompare(b[0])),
    [snapshot]
  );

  const refreshValues = () => {
    setSnapshot(readSnapshot());
    addToast?.('Remote Config values refreshed.', 'info');
  };

  const copyValues = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
      addToast?.('Remote Config values copied.', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast?.('Failed to copy Remote Config values.', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-theme-secondary">
        Live view of the currently resolved Remote Config values on this device.
      </p>

      <div className="flex gap-2">
        <button
          onClick={refreshValues}
          className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          Refresh Values
        </button>
        <button
          onClick={copyValues}
          className="rounded-lg bg-theme-primary px-3 py-2 text-sm font-medium text-theme-secondary border border-theme hover:bg-theme-secondary"
        >
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-theme bg-theme-primary">
        <div className="divide-y divide-theme">
          {sortedEntries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[1.4fr_1fr] gap-3 px-3 py-2 text-xs">
              <div className="break-all font-mono text-theme-primary">{key}</div>
              <div className="break-all font-mono text-theme-secondary">{String(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
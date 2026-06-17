import React, { useEffect, useState } from 'react';
import { X, Terminal, Cpu } from 'lucide-react';

interface GeminiTokenDebugDetail {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  type: 'recipe-search' | 'pantry-scan' | 'receipt-scan';
  model: string;
}

interface GeminiTokenDebuggerProps {
  isAdmin: boolean;
}

export const GeminiTokenDebugger: React.FC<GeminiTokenDebuggerProps> = ({ isAdmin }) => {
  const [debugData, setDebugData] = useState<GeminiTokenDebugDetail | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const handleDebugEvent = (e: Event) => {
      const customEvent = e as CustomEvent<GeminiTokenDebugDetail>;
      if (customEvent.detail) {
        setDebugData(customEvent.detail);
        setIsVisible(true);
      }
    };

    window.addEventListener('gemini-token-debug', handleDebugEvent);
    return () => {
      window.removeEventListener('gemini-token-debug', handleDebugEvent);
    };
  }, [isAdmin]);

  if (!isAdmin || !debugData || !isVisible) return null;

  const getFriendlyType = (type: string) => {
    switch (type) {
      case 'recipe-search':
        return 'Recipe Search';
      case 'pantry-scan':
        return 'Pantry Image Scan';
      case 'receipt-scan':
        return 'Receipt Scan';
      default:
        return 'Gemini Request';
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideInUp {
          from {
            transform: translateY(20px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-slide-in-up {
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div className="fixed bottom-20 right-4 z-[9999] max-w-sm w-full bg-slate-900/90 dark:bg-slate-950/90 text-white rounded-xl border border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.25)] backdrop-blur-md transition-all duration-300 animate-slide-in-up p-[1px] bg-gradient-to-br from-purple-500/20 via-transparent to-pink-500/20">
        <div className="bg-slate-900/95 dark:bg-slate-950/95 rounded-[11px] overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-purple-950/20">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                Gemini Token Debugger
              </span>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Operation:</span>
              <span className="font-semibold text-purple-300">{getFriendlyType(debugData.type)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Model:</span>
              <span className="font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white/90">
                {debugData.model}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
              <div className="bg-white/5 p-2 rounded text-center">
                <div className="text-[10px] text-white/50 mb-0.5">Input</div>
                <div className="text-xs font-semibold text-purple-200">{debugData.inputTokens}</div>
              </div>
              <div className="bg-white/5 p-2 rounded text-center">
                <div className="text-[10px] text-white/50 mb-0.5">Output</div>
                <div className="text-xs font-semibold text-purple-200">{debugData.outputTokens}</div>
              </div>
              <div className="bg-white/5 p-2 rounded text-center border border-purple-500/20 bg-purple-500/5">
                <div className="text-[10px] text-purple-300/60 mb-0.5">Total</div>
                <div className="text-xs font-semibold text-purple-300">{debugData.totalTokens}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-white/40 pt-1 justify-center">
              <Cpu className="w-3 h-3 text-purple-500/50" />
              <span>Authorized Admin View Only</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

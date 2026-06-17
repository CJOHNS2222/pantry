import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Search, Plus, X, Loader2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useModalOpen } from '../../utils/useModalOpen';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useAppActions } from '../../contexts/AppActionsContext';
import { log } from '../../services/logService';

interface QuickAddItem {
  name: string;
  category?: string;
  quantity?: string;
  unit?: string;
}

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: QuickAddItem) => void;
  onScanBarcode?: () => Promise<QuickAddItem | null>;
  onVoiceInput?: () => Promise<string | null>;
  isOnline: boolean;
  recentItems?: string[];
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  onScanBarcode,
  onVoiceInput,
  isOnline,
  recentItems = []
}) => {
  useModalOpen(isOpen);
  useAndroidBack(isOpen, onClose);
  const intl = useIntl();
  const { addToast } = useAppActions();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  useAndroidBack(isOpen && showSuggestions, () => setShowSuggestions(false));
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recognition setup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = window;
    if (win.webkitSpeechRecognition || win.SpeechRecognition) {
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = intl.locale || 'en-US'; // updated at start() time too

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) setInput(transcript);
          setIsListening(false);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionRef.current.onerror = (ev: any) => {
          setIsListening(false);
          const errorCode: string = ev?.error || '';
          if (errorCode !== 'no-speech' && errorCode !== 'aborted') {
            addToast('Voice input failed. Please try again or type your item.', 'error');
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      } catch {
        // Ignore initialization errors
      }
    }

    return () => {
      try {
        if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
          recognitionRef.current.stop();
        }
      } catch {
        // ignore
      }
    };
  }, []);

  // Generate suggestions based on input
  useEffect(() => {
    if (input.length > 0) {
      const filtered = recentItems.filter(item =>
        item.toLowerCase().includes(input.toLowerCase())
      ).slice(0, 5);
      setSuggestions(prev => {
        if (prev.length === filtered.length && prev.every((v, i) => v === filtered[i])) return prev;
        return filtered;
      });
      setShowSuggestions(filtered.length > 0);
    } else {
      // Use functional updater to keep the same reference when already empty,
      // preventing an infinite loop when recentItems defaults to a new [] each render.
      setSuggestions(prev => prev.length === 0 ? prev : []);
      setShowSuggestions(false);
    }
  }, [input, recentItems]);

  const handleVoiceInput = async () => {
    if (!recognitionRef.current) {
      // Fallback to custom voice input if available
      if (onVoiceInput) {
        setIsListening(true);
        try {
          const result = await onVoiceInput();
          if (result) {
            setInput(result);
          }
        } catch (error) {
          log.error('Voice input failed', { error }, 'QuickAddModal');
        } finally {
          setIsListening(false);
        }
      }
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.lang = intl.locale || 'en-US';
      recognitionRef.current.start();
    }
  };

  const handleScanBarcode = async () => {
    if (!onScanBarcode || !isOnline) return;

    setIsScanning(true);
    try {
      const scannedItem = await onScanBarcode();
      if (scannedItem) {
        onAddItem(scannedItem);
        onClose();
      }
    } catch (error) {
      log.error('Barcode scan failed', { error }, 'QuickAddModal');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (itemName?: string) => {
    const itemToAdd = itemName || input.trim();
    if (!itemToAdd) return;

    // Parse quantity and unit from input (e.g., "2 lbs chicken" -> { name: "chicken", quantity: "2", unit: "lbs" })
    const quantityMatch = itemToAdd.match(/^(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)$/);
    let parsedItem: QuickAddItem;

    if (quantityMatch) {
      const [, quantity, unit, name] = quantityMatch;
      parsedItem = {
        name: name.trim(),
        quantity,
        unit
      };
    } else {
      parsedItem = {
        name: itemToAdd
      };
    }

    onAddItem(parsedItem);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]" onClick={handleBackdropClick} data-testid="quickadd-backdrop">
      <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto h-full flex flex-col overflow-hidden border border-theme" role="dialog" aria-modal="true" aria-label="Add Item">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <h3 className="text-lg font-semibold text-theme-primary">Add Item</h3>
          <button
            onClick={onClose}
            className="text-theme-secondary opacity-70 hover:opacity-100 hover:text-theme-primary p-1"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="relative mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                data-testid="quickadd-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder="Add item (e.g., '2 lbs chicken' or 'milk')"
                className="w-full bg-theme-secondary border border-theme rounded-lg px-3 py-3 text-black placeholder-theme-secondary/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] pr-10"
              />

              {input && (
                <button
                  onClick={() => setInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary"
                  data-testid="quickadd-clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="px-4 py-3 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="quickadd-submit"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-theme-primary border border-theme rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-theme-secondary transition-colors first:rounded-t-lg last:rounded-b-lg"
                  data-testid={`quickadd-suggestion-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3 h-3 text-theme-secondary" />
                    <span className="text-sm text-theme-primary">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-theme-secondary text-theme-primary hover:bg-theme-primary border border-theme rounded-lg transition-colors"
            data-testid="quickadd-cancel"
          >
            Cancel
          </button>

          <button
            onClick={handleVoiceInput}
            disabled={!isOnline || isScanning}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary border border-theme'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            data-testid="quickadd-voice"
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span className="text-sm">Listening...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span className="text-sm">Voice</span>
              </>
            )}
          </button>

          <button
            onClick={handleScanBarcode}
            disabled={!isOnline || isScanning || !onScanBarcode}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary hover:bg-theme-primary border border-theme rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="quickadd-scan"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span className="text-sm">Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Helper Text */}
        <div className="text-xs text-theme-secondary opacity-70">
          Try: "2 lbs chicken", "milk", "bread" • Voice input works offline
        </div>
        </div>
      </div>
    </div>
  );
};
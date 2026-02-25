import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Search, Plus, X, Loader2 } from 'lucide-react';

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
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recognition setup
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Generate suggestions based on input
  useEffect(() => {
    if (input.length > 0) {
      const filtered = recentItems.filter(item =>
        item.toLowerCase().includes(input.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
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
          console.error('Voice input failed:', error);
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
      console.error('Barcode scan failed:', error);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[80vh] overflow-hidden border border-theme">
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
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="relative mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
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
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="px-4 py-3 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
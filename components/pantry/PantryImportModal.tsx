import React, { useState } from 'react';
import { X, Upload, Download, FileText } from 'lucide-react';
import { parseCsvToPantryItems, persistImportedPantryItems } from '../../services/importService';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PantryItem } from '../../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { useAndroidBack } from '../../hooks/useAndroidBack';

interface PantryImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: (items: PantryItem[]) => void;
}

const PantryImportModal: React.FC<PantryImportModalProps> = ({ open, onClose, onImported }) => {
  const { user, household } = useApp();
  const { addToast } = useAppActions();
  const modalRef = useFocusTrap({ isActive: open, onEscape: onClose });
  useAndroidBack(open, onClose);
  
  const [csvText, setCsvText] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();

    const isPlainText = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    let csvPayload = text;
    if (isPlainText) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      csvPayload = ['name', ...lines].join('\n');
    }

    setCsvText(csvPayload);
    const items = parseCsvToPantryItems(csvPayload);
    setPreviewCount(items.length);
  };

  const handleImportPantry = async () => {
    setLoading(true);
    try {
      const items = parseCsvToPantryItems(csvText);
      await persistImportedPantryItems(items, household?.id, user?.id);
      
      try {
        if (onImported && items.length > 0) {
          onImported(items);
        }
      } catch (cbErr) {
        log.warn('onImported callback failed', { error: String(cbErr) }, 'PantryImportModal');
      }
      addToast(`Imported ${items.length} pantry items`, 'success');
      onClose();
      
      AnalyticsService.trackEvent('pantry_imported', {
        itemCount: items.length,
        householdId: household?.id,
        userId: user?.id
      });
    } catch (err) {
      log.error('Failed to import pantry items', { error: String(err) }, 'PantryImportModal');
      addToast('Failed to import pantry items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportFile = async (content: string, filename: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        addToast(`Saved to Documents/${filename}`, 'success');
      } catch (err) {
        log.error('Native file export failed', { error: String(err) }, 'PantryImportModal');
        addToast('Could not save file to device', 'error');
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        ref={modalRef} 
        role="dialog" 
        aria-modal="true" 
        aria-label="Import Pantry Items" 
        className="bg-theme-primary border border-theme rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold font-serif text-theme-primary">Import Pantry Items</h2>
            <p className="text-xs text-theme-secondary opacity-65">Upload a CSV or plain-text list of items</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-theme-secondary hover:bg-theme-secondary/80 rounded-full transition-colors"
            data-testid="import-close"
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <div className="text-xs text-theme-primary opacity-80 leading-relaxed bg-theme-secondary/25 p-3.5 rounded-2xl border border-theme">
            Upload a <strong>CSV</strong> or plain-text <strong>.txt</strong> list. CSV columns can include:
            <code className="block mt-1 bg-theme-primary p-1.5 rounded border border-theme text-[10px] overflow-x-auto text-[var(--accent-color)]">
              item,quantity,unit,category,storageLocation,expirationDate
            </code>
          </div>

          <div className="flex items-center justify-between gap-4 bg-theme-secondary/20 p-4 rounded-2xl border border-theme">
            <div className="flex items-center gap-2 text-xs font-bold text-theme-primary">
              <Upload className="w-4 h-4 text-[var(--accent-color)]" />
              <span>Select File</span>
            </div>
            <div className="flex gap-2">
              <label className="px-3 py-1.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm">
                Browse
                <input 
                  type="file" 
                  accept=".csv,.txt,text/csv,text/plain" 
                  onChange={(e) => handleFile(e.target.files?.[0])} 
                  className="hidden" 
                  data-testid="import-file-input" 
                />
              </label>
              <button
                onClick={() => handleExportFile(
                  'item,quantity,unit,category,storageLocation,expirationDate\nApples,6,count,Produce,fridge,2026-05-20\nChicken Breast,500,g,Meat & Seafood,freezer,2026-06-01',
                  'pantry-template.csv'
                )}
                className="px-3 py-1.5 bg-theme-secondary hover:bg-theme-secondary/80 rounded-xl text-xs font-bold transition-all border border-theme text-theme-secondary flex items-center gap-1"
                title="Download a sample CSV to see the required format"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">CSV/Text Editor Preview</span>
            <textarea 
              value={csvText} 
              onChange={(e) => { 
                setCsvText(e.target.value); 
                const items = parseCsvToPantryItems(e.target.value); 
                setPreviewCount(items.length); 
              }} 
              rows={6} 
              className="w-full p-3 rounded-2xl border border-theme bg-theme-primary text-theme-primary text-xs focus:border-[var(--accent-color)] focus:outline-none" 
              placeholder="Apples,6,count,Produce,fridge&#10;Chicken Breast,500,g,Meat & Seafood"
              data-testid="import-csv-textarea" 
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-theme flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-theme-secondary font-bold">
            Parsed rows: <span className="text-theme-primary">{previewCount}</span>
          </div>
          <div className="flex gap-3">
            {csvText && (
              <button 
                onClick={() => handleExportFile(csvText, 'pantry-export.csv')} 
                className="px-4 py-2.5 bg-theme-secondary hover:bg-theme-secondary/80 rounded-xl text-xs font-bold transition-all border border-theme text-theme-secondary flex items-center gap-1.5" 
                data-testid="import-export"
              >
                <FileText className="w-4 h-4" />
                Save Copy
              </button>
            )}
            <button 
              onClick={handleImportPantry} 
              disabled={loading || previewCount === 0} 
              className="px-4 py-2.5 bg-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-color)]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md" 
              data-testid="import-pantry"
            >
              Import Pantry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PantryImportModal;

import React, { useState, useMemo } from 'react';
import { X, Search, CheckSquare, Square, Download, Mail, MessageSquare, Share2, FileText } from 'lucide-react';
import { SavedRecipe } from '../../types';
import HapticService from '../../services/hapticService';
import AnalyticsService from '../../services/analyticsService';

interface RecipeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: SavedRecipe[];
}

type ExportFormat = 'pdf' | 'txt' | 'json';
type ShareMethod = 'download' | 'email' | 'sms' | 'share';

export const RecipeExportModal: React.FC<RecipeExportModalProps> = ({
  isOpen,
  onClose,
  recipes = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>(() => {
    // Default to all selected
    const initial: Record<string, boolean> = {};
    recipes.forEach(r => {
      if (r.id) initial[r.id] = true;
    });
    return initial;
  });

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [method, setMethod] = useState<ShareMethod>('download');
  const [isExporting, setIsExporting] = useState(false);

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [recipes, searchTerm]);

  // Check if all filtered are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredRecipes.length === 0) return false;
    return filteredRecipes.every(r => selectedIds[r.id]);
  }, [filteredRecipes, selectedIds]);

  const toggleSelectAll = () => {
    HapticService.light();
    setSelectedIds(prev => {
      const next = { ...prev };
      const val = !allFilteredSelected;
      filteredRecipes.forEach(r => {
        next[r.id] = val;
      });
      return next;
    });
  };

  const toggleSelectRecipe = (id: string) => {
    HapticService.light();
    setSelectedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Get final array of selected recipes
  const selectedRecipes = useMemo(() => {
    return recipes.filter(r => selectedIds[r.id]);
  }, [recipes, selectedIds]);

  // Is share API supported on current device
  const isShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  const handleExport = async () => {
    if (selectedRecipes.length === 0) return;
    HapticService.success();
    setIsExporting(true);

    try {
      if (format === 'json') {
        const jsonStr = JSON.stringify(selectedRecipes, null, 2);
        if (method === 'download') {
          triggerFileDownload(jsonStr, 'saved_recipes.json', 'application/json');
        } else if (method === 'email') {
          triggerEmailShare(jsonStr);
        } else if (method === 'sms') {
          triggerSMSShare(jsonStr);
        } else if (method === 'share') {
          await triggerWebShare('Exported Recipes.json', jsonStr, 'application/json');
        }
      } else if (format === 'txt') {
        const txtContent = generatePlainText(selectedRecipes);
        if (method === 'download') {
          triggerFileDownload(txtContent, 'recipes_export.txt', 'text/plain');
        } else if (method === 'email') {
          triggerEmailShare(txtContent);
        } else if (method === 'sms') {
          triggerSMSShare(txtContent);
        } else if (method === 'share') {
          await triggerWebShare('Recipes.txt', txtContent, 'text/plain');
        }
      } else if (format === 'pdf') {
        // PDF generation on web uses print window stylesheet
        triggerPDFPrint(selectedRecipes);
      }

      AnalyticsService.trackFeatureUsage('recipe_export', {
        success: true,
        count: selectedRecipes.length,
        format,
        method
      });
      
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      AnalyticsService.trackFeatureUsage('recipe_export', { success: false, error: errMsg });
      alert(`Export failed: ${errMsg}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Generators for file exports
  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const generatePlainText = (list: SavedRecipe[]): string => {
    let output = '=== STOCK & SPOON - EXPORTED RECIPES ===\n\n';
    list.forEach((r, idx) => {
      output += `${idx + 1}. ${r.title.toUpperCase()}\n`;
      if (r.description) output += `${r.description}\n`;
      if (r.cookTime) output += `Cook Time: ${r.cookTime}\n`;
      output += '\n--- INGREDIENTS ---\n';
      (r.ingredients || []).forEach(ing => {
        output += `- ${ing}\n`;
      });
      output += '\n--- STEPS ---\n';
      (r.instructions || []).forEach((step, sIdx) => {
        output += `${sIdx + 1}. ${step}\n`;
      });
      output += '\n========================================\n\n';
    });
    return output;
  };

  const triggerEmailShare = (content: string) => {
    const subject = encodeURIComponent('My Saved Recipes - Stock & Spoon');
    const body = encodeURIComponent(content.length > 1500 ? content.slice(0, 1500) + '\n\n[Truncated due to mailto link size limits...]' : content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const generateSMSText = (list: SavedRecipe[]): string => {
    let output = '';
    list.forEach((r, idx) => {
      output += `${r.title.toUpperCase()}\n`;
      if (r.description) output += `${r.description}\n`;
      if (r.cookTime) output += `Cook Time: ${r.cookTime}\n`;
      output += `\nIngredients:\n`;
      (r.ingredients || []).forEach(ing => {
        output += `• ${ing}\n`;
      });
      output += `\nInstructions:\n`;
      (r.instructions || []).forEach((step, sIdx) => {
        output += `${sIdx + 1}. ${step}\n`;
      });
      if (idx < list.length - 1) {
        output += `\n---\n\n`;
      }
    });
    return output;
  };

  const triggerSMSShare = (content: string) => {
    const smsBody = format === 'json' ? generateSMSText(selectedRecipes) : content;
    const bodyText = smsBody.length > 1500 
      ? smsBody.slice(0, 1500) + '\n\n[Truncated due to SMS size limits...]'
      : smsBody;
    const body = encodeURIComponent(bodyText);
    window.location.href = `sms:?&body=${body}`;
  };

  const triggerWebShare = async (filename: string, content: string, mimeType: string) => {
    if (!navigator.share) return;
    
    const file = new File([content], filename, { type: mimeType });
    // Check if navigator supports sharing files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Exported Recipes from Stock & Spoon',
        text: 'Here are my saved recipes!'
      });
    } else {
      // Fallback to text sharing
      await navigator.share({
        title: 'Exported Recipes from Stock & Spoon',
        text: content.length > 2000 ? content.slice(0, 2000) + '...' : content
      });
    }
  };

  const triggerPDFPrint = (list: SavedRecipe[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups to print PDF.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Stock & Spoon Recipes</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
            body { 
              font-family: 'Outfit', sans-serif; 
              padding: 40px; 
              color: #1f2937; 
              line-height: 1.6; 
              background: #fff;
            }
            .header-banner {
              border-bottom: 3px solid #e11d48;
              padding-bottom: 12px;
              margin-bottom: 35px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .header-banner h1 {
              font-family: 'Playfair Display', serif;
              font-size: 32px;
              font-weight: 900;
              color: #e11d48;
              margin: 0;
            }
            .header-banner span {
              font-size: 12px;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.1em;
            }
            .recipe-card { 
              margin-bottom: 50px; 
              page-break-after: always; 
            }
            .recipe-card:last-child { 
              page-break-after: avoid; 
            }
            h2 { 
              font-family: 'Playfair Display', serif; 
              font-size: 24px; 
              font-weight: 900;
              color: #111827; 
              margin-top: 0; 
              margin-bottom: 8px;
            }
            .description { 
              font-style: italic; 
              color: #4b5563; 
              margin-bottom: 18px;
              font-size: 14px;
            }
            .meta { 
              font-weight: 600; 
              font-size: 13px; 
              margin-bottom: 24px; 
              color: #e11d48; 
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            h3 { 
              font-size: 15px; 
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              border-bottom: 1px solid #e5e7eb; 
              padding-bottom: 6px; 
              margin-top: 25px; 
              color: #374151;
            }
            ul, ol { 
              padding-left: 20px; 
              margin-bottom: 20px;
            }
            li { 
              margin-bottom: 7px; 
              font-size: 14px;
            }
            @media print {
              body { padding: 0; }
              .header-banner { border-color: #000; }
              .meta { color: #000; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>Stock & Spoon</h1>
            <span>My Recipe Book</span>
          </div>
          ${list.map(r => `
            <div class="recipe-card">
              <h2>${r.title}</h2>
              ${r.description ? `<p class="description">${r.description}</p>` : ''}
              <div class="meta">Cook Time: ${r.cookTime || 'N/A'} • Servings: ${r.servings || 'N/A'}</div>
              <h3>Ingredients</h3>
              <ul>
                ${(r.ingredients || []).map(i => `<li>${i}</li>`).join('')}
              </ul>
              <h3>Instructions</h3>
              <ol>
                ${(r.instructions || []).map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
          `).join('')}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-theme-primary border border-theme rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold font-serif text-theme-primary">Export Selection</h2>
            <p className="text-xs text-theme-secondary opacity-65">Choose recipes and format to share</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-theme-secondary hover:bg-theme-secondary/80 rounded-full transition-colors"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Scrollable checklist & options */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-secondary" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-theme rounded-xl bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
            />
          </div>

          {/* Recipes Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">
                Select Recipes ({selectedRecipes.length} of {recipes.length})
              </span>
              <button
                onClick={toggleSelectAll}
                className="text-[10px] font-bold text-[var(--accent-color)] hover:underline"
              >
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="border border-theme rounded-2xl bg-theme-secondary/20 p-3 max-h-48 overflow-y-auto space-y-2">
              {filteredRecipes.length === 0 ? (
                <p className="text-xs text-theme-secondary italic text-center py-4">No recipes found matching search query</p>
              ) : (
                filteredRecipes.map(r => {
                  const isChecked = !!selectedIds[r.id];
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleSelectRecipe(r.id)}
                      className="flex items-center gap-3 py-1 cursor-pointer select-none group"
                    >
                      <button className="text-theme-secondary hover:text-[var(--accent-color)] transition-colors">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[var(--accent-color)]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`text-xs truncate ${isChecked ? 'text-theme-primary font-semibold' : 'text-theme-secondary opacity-85'}`}>
                        {r.title}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">Format</span>
            <div className="grid grid-cols-3 gap-2 bg-theme-secondary/25 p-1 rounded-xl border border-theme">
              {(['pdf', 'txt', 'json'] as ExportFormat[]).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => {
                    HapticService.light();
                    setFormat(fmt);
                    // PDF only supports print/download native dialog
                    if (fmt === 'pdf') setMethod('download');
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                    format === fmt
                      ? 'bg-[var(--accent-color)] text-white shadow-sm'
                      : 'text-theme-secondary opacity-65 hover:opacity-100'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Action Destination Selector (Only for non-PDF) */}
          {format !== 'pdf' && (
            <div className="space-y-2 animate-fade-in">
              <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">Share Method</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'download', label: 'Save', icon: Download },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'sms', label: 'Text', icon: MessageSquare },
                  ...(isShareSupported ? [{ id: 'share', label: 'Share', icon: Share2 }] : [])
                ].map(m => {
                  const Icon = m.icon;
                  const isActive = method === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        HapticService.light();
                        setMethod(m.id as ShareMethod);
                      }}
                      className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all gap-1.5 ${
                        isActive
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 text-[var(--accent-color)]'
                          : 'border-theme hover:border-theme-secondary text-theme-secondary opacity-75'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-theme flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-theme rounded-xl text-xs font-bold hover:bg-theme-secondary transition-colors text-theme-secondary"
          >
            Cancel
          </button>
          <button
            disabled={selectedRecipes.length === 0 || isExporting}
            onClick={handleExport}
            className="flex-1 py-3 bg-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-color)]/90 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
          >
            {format === 'pdf' ? (
              <>
                <FileText className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Export Selected</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

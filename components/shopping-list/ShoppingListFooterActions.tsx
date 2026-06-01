import React from 'react';
import { Copy, Share2, Download, MessageSquare } from 'lucide-react';

interface ShoppingListFooterActionsProps {
  hasItems: boolean;
  showAnalytics: boolean;
  onToggleAnalytics: () => void;
  onCopyToClipboard: () => void;
  onShare: () => void;
  onShareViaSMS: () => void;
  onExport: () => void;
}

export const ShoppingListFooterActions: React.FC<ShoppingListFooterActionsProps> = ({
  hasItems,
  showAnalytics,
  onToggleAnalytics,
  onCopyToClipboard,
  onShare,
  onShareViaSMS,
  onExport,
}) => {
  if (!hasItems) return null;

  return (
    <>
      <div className="flex justify-center mt-4">
        <button
          onClick={onToggleAnalytics}
          className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg hover:bg-theme-primary transition-colors text-sm"
        >
          {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-6 flex-wrap">
        <button
          onClick={onCopyToClipboard}
          className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
          title="Copy to clipboard"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
          title="Share shopping list"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <button
          onClick={onShareViaSMS}
          className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
          title="Send via text message"
        >
          <MessageSquare className="w-4 h-4" />
          SMS
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-theme-primary rounded-lg border border-theme hover:bg-theme-primary transition-colors text-sm"
          title="Download as text file"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
    </>
  );
};

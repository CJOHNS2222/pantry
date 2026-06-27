import React, { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, ChevronRight, Sparkles, RefreshCw, Wrench, Calendar, FileText } from 'lucide-react';
import { ALL_CHANGES } from '../../constants/changelogEntries';

interface ChangelogPageProps {
  onBack: () => void;
}

export const ChangelogPage: React.FC<ChangelogPageProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set([
    // Expand the latest version by default
    ALL_CHANGES[0]?.version
  ].filter(Boolean)));

  const filteredChanges = ALL_CHANGES.filter(entry => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    
    // Match version, date, or any bullet point content
    return (
      entry.version.toLowerCase().includes(term) ||
      entry.date.toLowerCase().includes(term) ||
      entry.sections.some(sec => 
        sec.title.toLowerCase().includes(term) ||
        sec.bullets.some(bullet => bullet.toLowerCase().includes(term))
      )
    );
  });

  const toggleVersion = (version: string) => {
    const next = new Set(expandedVersions);
    if (next.has(version)) {
      next.delete(version);
    } else {
      next.add(version);
    }
    setExpandedVersions(next);
  };

  const getSectionIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('add')) return <Sparkles className="w-3.5 h-3.5 text-green-500" />;
    if (lower.includes('fix')) return <Wrench className="w-3.5 h-3.5 text-red-500" />;
    return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
  };

  const getSectionBg = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('add')) return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20';
    if (lower.includes('fix')) return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20';
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
  };

  // Helper to highlight search terms
  const highlightText = (text: string, search: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-theme-primary rounded-sm px-0.5">{part}</mark>
          ) : part
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-theme-primary flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-theme bg-theme-secondary/50 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-theme transition-colors text-theme-primary"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--accent-color)]" />
          App Changelog
        </h1>

        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="p-4 border-b border-theme-secondary">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search release history... (e.g. leftovers, ads, camera)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 text-sm border border-theme rounded-xl bg-theme-secondary text-theme-primary focus:border-theme-primary focus:outline-none transition-colors"
            />
            <div className="absolute left-4 top-3.5 text-theme-secondary">
              <Search className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Results Count */}
        {searchTerm && (
          <div className="px-4 py-2 bg-theme-secondary/30 border-b border-theme-secondary">
            <p className="text-sm text-theme-secondary text-center">
              Found {filteredChanges.length} version{filteredChanges.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </p>
          </div>
        )}

        {/* Versions Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {filteredChanges.map((entry) => {
              const isExpanded = expandedVersions.has(entry.version);
              return (
                <div key={entry.version} className="bg-theme-secondary rounded-xl border border-theme overflow-hidden shadow-sm">
                  {/* Version Header Bar */}
                  <button
                    onClick={() => toggleVersion(entry.version)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-theme-primary/5 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-theme-primary">
                        v{entry.version}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-theme-secondary bg-theme-primary/40 border border-theme px-2 py-0.5 rounded-full">
                        <Calendar className="w-3 h-3" />
                        {entry.date}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-theme-primary flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-theme-primary flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded Bullet Points */}
                  {isExpanded && (
                    <div className="border-t border-theme px-6 py-5 space-y-5 bg-theme-primary/10">
                      {entry.sections.map((sec) => (
                        <div key={sec.title} className="space-y-2">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getSectionBg(sec.title)}`}>
                            {getSectionIcon(sec.title)}
                            {sec.title}
                          </div>
                          <ul className="space-y-2.5 pl-1">
                            {sec.bullets.map((bullet, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-sm text-theme-secondary leading-relaxed">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] flex-shrink-0" />
                                <div className="flex-1">
                                  {highlightText(bullet, searchTerm)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Results */}
            {filteredChanges.length === 0 && (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-theme-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-theme-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-theme-primary mb-2">No updates found</h3>
                  <p className="text-theme-secondary mb-4">
                    We couldn't find any release notes matching "{searchTerm}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ChangelogPage;

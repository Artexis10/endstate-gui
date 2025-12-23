import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle, Copy, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ApplyItem, ApplyCounts } from '../../types';
import { categorizeApplyItems, countCategorizedItems, isAllUpToDate } from '../../lib/apply-utils';

interface ApplyResultModalProps {
  open: boolean;
  onClose: () => void;
  onFixIssues?: () => void;
  counts: ApplyCounts;
  items: ApplyItem[];
  rawLogs?: string;
  rawEnvelope?: object;
}

export function ApplyResultModal({
  open,
  onClose,
  onFixIssues,
  counts,
  items,
  rawLogs,
  rawEnvelope,
}: ApplyResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Categorize items using the helper - derive from items array (source of truth)
  const categorizedGroups = useMemo(() => categorizeApplyItems(items), [items]);
  const itemCounts = useMemo(() => countCategorizedItems(categorizedGroups), [categorizedGroups]);

  // Use item-derived counts as primary, fall back to envelope counts
  const effectiveCounts = {
    installed: itemCounts.installed || counts.installed,
    alreadyInstalled: itemCounts.alreadyInstalled || counts.alreadyInstalled,
    skipped: itemCounts.skipped || counts.skippedFiltered,
    failed: itemCounts.failed || counts.failed,
  };

  // Determine status using helpers
  const hasIssues = effectiveCounts.failed > 0;
  const allUpToDate = isAllUpToDate(counts, itemCounts);

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const copyDiagnostics = async () => {
    const diagnostics = [
      '=== Apply Diagnostics ===',
      `Installed: ${effectiveCounts.installed}`,
      `Already installed: ${effectiveCounts.alreadyInstalled}`,
      `Skipped (filtered): ${effectiveCounts.skipped}`,
      `Failed: ${effectiveCounts.failed}`,
      '',
      '--- Envelope Counts ---',
      `total: ${counts.total}`,
      `installed: ${counts.installed}`,
      `alreadyInstalled: ${counts.alreadyInstalled}`,
      `skippedFiltered: ${counts.skippedFiltered}`,
      `failed: ${counts.failed}`,
      '',
      '--- Items (${items.length}) ---',
      ...items.map(i => `${i.status.toUpperCase()}: ${i.id} (${i.driver}) - ${i.reason}${i.message ? ': ' + i.message : ''}`),
      '',
      '--- Raw Envelope ---',
      rawEnvelope ? JSON.stringify(rawEnvelope, null, 2) : '(not available)',
      '',
      '--- Logs ---',
      rawLogs || '(not available)',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render a collapsible section with items grouped by driver
  const renderSection = (
    title: string,
    icon: string,
    groupedItems: Record<string, ApplyItem[]>,
    sectionKey: string,
    bgColor: string
  ) => {
    const totalCount = Object.values(groupedItems).reduce((sum, arr) => sum + arr.length, 0);
    if (totalCount === 0) return null;
    
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection(sectionKey)}
          className={`flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 ${bgColor}`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm">{icon}</span>
            <span className="text-sm font-medium">{title}</span>
          </div>
          <span className="text-xs text-muted-foreground">{totalCount}</span>
        </button>
        
        {isExpanded && (
          <div className="border-t border-border max-h-48 overflow-y-auto">
            {Object.entries(groupedItems).map(([driver, driverItems]) => (
              <div key={driver}>
                <div className="px-3 py-1 bg-muted/30 text-xs font-medium text-muted-foreground">
                  {driver}
                </div>
                {driverItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0">
                    <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono truncate flex-1">{item.id}</span>
                    {item.message && (
                      <span className="text-muted-foreground text-xs truncate max-w-[150px]" title={item.message}>
                        {item.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Determine title and description based on status
  const getTitle = () => {
    if (hasIssues) return 'Setup complete with issues';
    if (allUpToDate) return 'Your computer is ready';
    return 'Setup complete';
  };

  const getDescription = () => {
    if (hasIssues) {
      return `${effectiveCounts.failed} app${effectiveCounts.failed > 1 ? 's' : ''} need${effectiveCounts.failed === 1 ? 's' : ''} attention`;
    }
    if (allUpToDate) {
      return 'All apps are already installed and up to date';
    }
    return 'All apps are ready to use';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {hasIssues ? (
              <AlertTriangle className="h-8 w-8 text-warning" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
            <DialogTitle className="text-2xl">
              {getTitle()}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Non-technical summary - use effectiveCounts */}
        <div className="space-y-3 py-4">
          {effectiveCounts.installed > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <span className="text-sm font-medium">Installed</span>
              <span className="text-2xl font-semibold text-success">{effectiveCounts.installed}</span>
            </div>
          )}
          
          {effectiveCounts.alreadyInstalled > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <span className="text-sm font-medium">{allUpToDate ? 'Up to date' : 'Already installed'}</span>
              <span className="text-2xl font-semibold text-success">{effectiveCounts.alreadyInstalled}</span>
            </div>
          )}
          
          {effectiveCounts.skipped > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <span className="text-sm font-medium">Skipped</span>
              <span className="text-2xl font-semibold text-muted-foreground">{effectiveCounts.skipped}</span>
            </div>
          )}
          
          {effectiveCounts.failed > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-sm font-medium">Needs attention</span>
              <span className="text-2xl font-semibold text-destructive">{effectiveCounts.failed}</span>
            </div>
          )}
        </div>

        {/* Details expander (technical) - use categorizedGroups */}
        {items.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full"
            >
              {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Details ({items.length} apps)
            </button>
            
            {showDetails && (
              <div className="mt-3 space-y-2">
                {renderSection('Installed', '✅', categorizedGroups.installed, 'installed', '')}
                {renderSection('Already installed', '✅', categorizedGroups.alreadyInstalled, 'already', '')}
                {renderSection('Skipped', '⏭️', categorizedGroups.skipped, 'skipped', '')}
                {renderSection('Needs attention', '❌', categorizedGroups.failed, 'failed', 'bg-destructive/5')}
                
                {/* Copy diagnostics */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyDiagnostics}
                    className="h-8 gap-2"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied!' : 'Copy diagnostics'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {hasIssues && onFixIssues ? (
            <Button onClick={() => { onClose(); onFixIssues(); }} className="w-full" variant="danger">
              Fix {effectiveCounts.failed} issue{effectiveCounts.failed > 1 ? 's' : ''}
            </Button>
          ) : null}
          <Button variant={hasIssues ? "secondary" : "primary"} onClick={onClose} className="w-full">
            {hasIssues ? 'Close' : 'Finish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

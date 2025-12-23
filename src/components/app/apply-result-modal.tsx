import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle, Copy, Package, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ApplyItem, ApplyCounts } from '../../types';
import { categorizeApplyItems, countCategorizedItems } from '../../lib/apply-utils';

interface ApplyResultModalProps {
  open: boolean;
  onClose: () => void;
  onApplyChanges?: () => void;
  counts: ApplyCounts;
  items: ApplyItem[];
  isDryRun: boolean;  // True for preview (apply --dry-run), false for actual apply
  isApplying?: boolean;  // True when transitioning from preview to apply
  currentProgress?: { currentApp: string; action: string };  // Real-time progress during apply
  rawLogs?: string;
  rawEnvelope?: object;
}

export function ApplyResultModal({
  open,
  onClose,
  onApplyChanges,
  counts,
  items,
  isDryRun,
  isApplying = false,
  currentProgress,
  rawLogs,
  rawEnvelope,
}: ApplyResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Categorize items using the helper - derive from items array (source of truth)
  const categorizedGroups = useMemo(() => categorizeApplyItems(items), [items]);
  const itemCounts = useMemo(() => countCategorizedItems(categorizedGroups), [categorizedGroups]);

  // Semantic counts for UI display
  const willBeInstalled = itemCounts.willBeInstalled;
  const installedThisRun = itemCounts.installedThisRun;
  const alreadyPresent = itemCounts.alreadyPresent;
  const needsAttention = itemCounts.needsAttention;
  const skippedCount = itemCounts.skipped;
  
  // Determine status:
  // - hasFailures: any failed items
  // - hasPendingChanges: items that would be installed (from dry-run preview)
  // - isReady: no failures AND no pending changes (everything already installed or just installed)
  const hasFailures = needsAttention > 0;
  const hasPendingChanges = willBeInstalled > 0;
  // "Your computer is ready" ONLY when: no failures, no pending installs
  const isReady = !hasFailures && !hasPendingChanges && (alreadyPresent > 0 || installedThisRun > 0);

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
      `Will be installed: ${willBeInstalled}`,
      `Installed this run: ${installedThisRun}`,
      `Already present: ${alreadyPresent}`,
      `Needs attention: ${needsAttention}`,
      `Skipped: ${skippedCount}`,
      '',
      '--- Envelope Counts ---',
      `total: ${counts.total}`,
      `installed: ${counts.installed}`,
      `alreadyInstalled: ${counts.alreadyInstalled}`,
      `skippedFiltered: ${counts.skippedFiltered}`,
      `failed: ${counts.failed}`,
      '',
      `--- Items (${items.length}) ---`,
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

  // Determine title and description based on status and phase
  const getTitle = () => {
    if (isApplying) return 'Applying changes...';
    if (hasFailures) return 'Setup incomplete';
    if (hasPendingChanges) return 'Changes ready to apply';
    if (isReady) return 'Your computer is ready';
    return 'Your computer is ready';
  };

  const getDescription = () => {
    if (isApplying) {
      if (currentProgress?.currentApp) {
        return `${currentProgress.action}: ${currentProgress.currentApp}`;
      }
      return 'Installing apps...';
    }
    if (hasFailures) {
      return `${needsAttention} app${needsAttention > 1 ? 's' : ''} need${needsAttention === 1 ? 's' : ''} attention`;
    }
    if (hasPendingChanges) {
      return `${willBeInstalled} app${willBeInstalled > 1 ? 's' : ''} will be installed`;
    }
    if (installedThisRun > 0) {
      return `${installedThisRun} app${installedThisRun > 1 ? 's' : ''} installed`;
    }
    return 'All apps are already present';
  };

  return (
    <Dialog open={open} onOpenChange={isApplying ? undefined : onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {isApplying ? (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            ) : hasFailures ? (
              <AlertTriangle className="h-8 w-8 text-destructive" />
            ) : hasPendingChanges ? (
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

        {/* Non-technical summary - phase-aware display */}
        <div className="space-y-3 py-4">
          {/* During applying: show stable progress, not preview counts */}
          {isApplying ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium">Installing</span>
              <span className="text-2xl font-semibold text-primary">{willBeInstalled}</span>
            </div>
          ) : (
            <>
              {/* Will be installed (preview only - from dry-run, NOT during applying) */}
              {isDryRun && willBeInstalled > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <span className="text-sm font-medium">Will be installed</span>
                  <span className="text-2xl font-semibold text-warning">{willBeInstalled}</span>
                </div>
              )}
              
              {/* Installed this run (apply result only - never shown in preview) */}
              {!isDryRun && installedThisRun > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
                  <span className="text-sm font-medium">Installed this run</span>
                  <span className="text-2xl font-semibold text-success">{installedThisRun}</span>
                </div>
              )}
              
              {/* Already present */}
              {alreadyPresent > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
                  <span className="text-sm font-medium">Already present</span>
                  <span className="text-2xl font-semibold text-muted-foreground">{alreadyPresent}</span>
                </div>
              )}
              
              {/* Needs attention (failures) */}
              {needsAttention > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <span className="text-sm font-medium">Needs attention</span>
                  <span className="text-2xl font-semibold text-destructive">{needsAttention}</span>
                </div>
              )}
              
              {/* Skipped (advanced - only show if > 0) */}
              {skippedCount > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
                  <span className="text-sm font-medium">Skipped</span>
                  <span className="text-2xl font-semibold text-muted-foreground">{skippedCount}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Details expander (technical) - hide during applying to avoid re-rendering preview items */}
        {items.length > 0 && !isApplying && (
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
                {/* Preview: show Will be installed */}
                {isDryRun && renderSection('Will be installed', '📦', categorizedGroups.willBeInstalled, 'willBeInstalled', 'bg-warning/5')}
                {/* Apply result: show Installed this run */}
                {!isDryRun && renderSection('Installed this run', '✅', categorizedGroups.installedThisRun, 'installedThisRun', '')}
                {renderSection('Already present', '✅', categorizedGroups.alreadyPresent, 'alreadyPresent', '')}
                {renderSection('Needs attention', '❌', categorizedGroups.needsAttention, 'needsAttention', 'bg-destructive/5')}
                {renderSection('Skipped', '⏭️', categorizedGroups.skipped, 'skipped', '')}
                
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
          {/* Apply changes button - only in preview mode with pending changes */}
          {!isApplying && hasPendingChanges && onApplyChanges && (
            <Button 
              onClick={onApplyChanges} 
              className="w-full h-10"
            >
              Apply changes
            </Button>
          )}
          {/* Close/Cancel/Done button - disabled during apply */}
          <Button 
            variant={hasPendingChanges && !isApplying ? "secondary" : "primary"} 
            onClick={onClose} 
            className="w-full h-10"
            disabled={isApplying}
          >
            {isApplying ? 'Please wait...' : hasPendingChanges ? 'Cancel' : hasFailures ? 'Close' : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { FilterChip } from '../ui/filter-chip';
import { CheckCircle2, AlertTriangle, Copy, Package, Loader2, Settings, FolderArchive } from 'lucide-react';
import { useState, useMemo, useRef, useCallback } from 'react';
import { DetailsDisclosure } from '../ui/details-disclosure';
import { useShowDetails } from '@/lib/use-show-details';
import type { ApplyItem, ApplyCounts, RestoreItem, RestoreSummary } from '../../types';
import {
  categorizeApplyItems,
  countCategorizedItems,
  reasonToStatusKey,
  getUiStatus,
  getColorClasses,
  type StatusKey,
} from '../../lib/apply-utils';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';

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
  restoreItems?: RestoreItem[];
  restoreSummary?: RestoreSummary;
  restoreJournalFile?: string;
  onRevertSettings?: () => void;
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
  restoreSummary,
  onRevertSettings,
}: ApplyResultModalProps) {
  const copyFeedback = useMicroFeedback(2000);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const showDetails = useShowDetails();
  
  // Local guard to prevent double-click on Apply button
  const applyClickedRef = useRef(false);
  
  // Wrapped onApplyChanges with local idempotency guard
  const handleApplyClick = useCallback(() => {
    if (applyClickedRef.current || !onApplyChanges) return;
    applyClickedRef.current = true;
    onApplyChanges();
  }, [onApplyChanges]);
  
  // Reset local guard when modal closes or apply completes
  // (isApplying goes false when done)
  if (!isApplying && !open) {
    applyClickedRef.current = false;
  }

  // Categorize items using the helper - derive from items array (source of truth)
  const categorizedGroups = useMemo(() => categorizeApplyItems(items), [items]);
  const itemCounts = useMemo(() => countCategorizedItems(categorizedGroups), [categorizedGroups]);

  // Semantic counts for UI display
  const willBeInstalled = itemCounts.willBeInstalled;
  const installedThisRun = itemCounts.installedThisRun;
  const alreadyPresent = itemCounts.alreadyPresent;
  const needsAttention = itemCounts.needsAttention;
  const skippedCount = itemCounts.skipped;

  // Manual apps requiring user action
  const manualItems = useMemo(
    () => items.filter(item => item.reason === 'manual_required'),
    [items]
  );
  
  // Determine status:
  // - hasFailures: any failed items
  // - hasPendingChanges: items that would be installed (from dry-run preview)
  // - isReady: no failures AND no pending changes (everything already installed or just installed)
  const hasFailures = needsAttention > 0;
  const hasPendingChanges = willBeInstalled > 0;
  // "Your computer is ready" ONLY when: no failures, no pending installs
  const isReady = !hasFailures && !hasPendingChanges && (alreadyPresent > 0 || installedThisRun > 0);

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

    await copyFeedback.triggerAsync(
      () => copyText(diagnostics),
      'Copied',
      'Copy failed'
    );
  };

  // Get action label and style for an item based on its reason and phase
  // Uses UI_STATUS_MAP as single source of truth for consistent labels and colors
  const getActionBadge = (item: ApplyItem): { label: string; className: string; statusKey: StatusKey } => {
    const statusKey = reasonToStatusKey(item);
    const uiStatus = getUiStatus(statusKey);
    const colors = getColorClasses(uiStatus.color);
    
    // Use long label for modal display, with special case for "Needs attention"
    let label = uiStatus.longLabel;
    if (statusKey === 'failed') {
      label = 'Needs attention';
    } else if (statusKey === 'installed') {
      label = 'Installed this run';
    }
    
    return { 
      label, 
      className: `${colors.bg} ${colors.text} ${colors.border}`,
      statusKey,
    };
  };

  // Sort items: actionable items first (will be installed, needs attention), then already present
  const sortedItems = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      'would_install': 0,
      'manual_required': 1,
      'failed': 2,
      'install_failed': 2,
      'installed': 3,
      'already_installed': 4,
      'already_present': 4,
      'user_denied': 5,
      'skipped': 6,
      'filtered': 6,
    };
    return [...items].sort((a, b) => {
      const aPriority = priorityOrder[a.reason || ''] ?? 6;
      const bPriority = priorityOrder[b.reason || ''] ?? 6;
      return aPriority - bPriority;
    });
  }, [items]);

  // Filter items based on active filters
  const filteredItems = useMemo(() => {
    if (activeFilters.size === 0) return sortedItems;
    return sortedItems.filter(item => {
      const badge = getActionBadge(item);
      return activeFilters.has(badge.label);
    });
  }, [sortedItems, activeFilters]);

  // Toggle filter
  const toggleFilter = (label: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // Total apps checked = all items in the list
  const totalChecked = items.length;

  // Determine title and description based on status and phase
  const getTitle = () => {
    if (isApplying) return 'Applying changes...';
    if (hasFailures && !isDryRun) return 'Completed with issues';
    if (hasFailures && isDryRun) return 'Setup preview';
    if (hasPendingChanges) return "Here's what will change";
    if (isReady) return 'Your computer is ready';
    return 'Your computer is ready';
  };

  const getDescription = () => {
    if (isApplying) {
      // Show what's being installed vs already present
      const appsToInstall = willBeInstalled;
      if (currentProgress?.currentApp) {
        return `Installing ${appsToInstall} app${appsToInstall > 1 ? 's' : ''} — ${currentProgress.currentApp}`;
      }
      return `Installing ${appsToInstall} app${appsToInstall > 1 ? 's' : ''} (${alreadyPresent} already present)`;
    }
    if (hasFailures && !isDryRun) {
      // Apply completed with some failures
      return `Checked ${totalChecked} apps — ${installedThisRun} installed, ${needsAttention} failed`;
    }
    if (hasFailures && isDryRun) {
      // Preview showing issues
      return `Checked ${totalChecked} apps — ${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`;
    }
    if (hasPendingChanges) {
      // Preview: emphasize checked vs changing, with reassurance
      return `Checked ${totalChecked} apps — ${willBeInstalled} will be installed. No changes made yet.`;
    }
    if (installedThisRun > 0) {
      // Final result after apply
      return `Checked ${totalChecked} apps — ${installedThisRun} installed this run`;
    }
    // All already present
    return `Checked ${totalChecked} apps — all already present`;
  };

  // Handle dialog open change - prevent closing while applying
  const handleOpenChange = useCallback((newOpen: boolean) => {
    // Ignore close attempts while applying
    if (!newOpen && isApplying) {
      return;
    }
    if (!newOpen) {
      onClose();
    }
  }, [isApplying, onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[80vh] flex flex-col"
        onEscapeKeyDown={isApplying ? (e) => e.preventDefault() : undefined}
        onPointerDownOutside={isApplying ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            {isApplying ? (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            ) : hasFailures ? (
              <AlertTriangle className="h-8 w-8 text-danger" />
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

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-2">
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
              {/* To install (preview only - from dry-run, NOT during applying) */}
              {isDryRun && willBeInstalled > 0 && (
                <FilterChip
                  pressed={activeFilters.has('To install')}
                  dimmed={activeFilters.size > 0 && !activeFilters.has('To install')}
                  onClick={() => toggleFilter('To install')}
                  data-testid="filter-to-install"
                  className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20 w-full text-left"
                >
                  <span className="text-sm font-medium">To install</span>
                  <span className="text-2xl font-semibold text-warning">{willBeInstalled}</span>
                </FilterChip>
              )}
              
              {/* Installed this run (apply result only - never shown in preview) */}
              {!isDryRun && installedThisRun > 0 && (
                <FilterChip
                  pressed={activeFilters.has('Installed this run')}
                  dimmed={activeFilters.size > 0 && !activeFilters.has('Installed this run')}
                  onClick={() => toggleFilter('Installed this run')}
                  data-testid="filter-installed-this-run"
                  className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20 w-full text-left"
                >
                  <span className="text-sm font-medium">Installed this run</span>
                  <span className="text-2xl font-semibold text-success">{installedThisRun}</span>
                </FilterChip>
              )}
              
              {/* Already present */}
              {alreadyPresent > 0 && (
                <FilterChip
                  pressed={activeFilters.has('Already present')}
                  dimmed={activeFilters.size > 0 && !activeFilters.has('Already present')}
                  onClick={() => toggleFilter('Already present')}
                  data-testid="filter-already-present"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20 w-full text-left"
                >
                  <span className="text-sm font-medium">Already present</span>
                  <span className="text-2xl font-semibold text-muted-foreground">{alreadyPresent}</span>
                </FilterChip>
              )}
              
              {/* Needs attention (failures) */}
              {needsAttention > 0 && (
                <FilterChip
                  pressed={activeFilters.has('Needs attention')}
                  dimmed={activeFilters.size > 0 && !activeFilters.has('Needs attention')}
                  onClick={() => toggleFilter('Needs attention')}
                  data-testid="filter-needs-attention"
                  className="flex items-center justify-between p-4 rounded-lg bg-danger/10 border border-danger/20 w-full text-left"
                >
                  <span className="text-sm font-medium">Needs attention</span>
                  <span className="text-2xl font-semibold text-danger">{needsAttention}</span>
                </FilterChip>
              )}
              
              {/* Skipped (advanced - only show if > 0) */}
              {skippedCount > 0 && (
                <FilterChip
                  pressed={activeFilters.has('Skipped')}
                  dimmed={activeFilters.size > 0 && !activeFilters.has('Skipped')}
                  onClick={() => toggleFilter('Skipped')}
                  data-testid="filter-skipped"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20 w-full text-left"
                >
                  <span className="text-sm font-medium">Skipped</span>
                  <span className="text-2xl font-semibold text-muted-foreground">{skippedCount}</span>
                </FilterChip>
              )}
            </>
          )}
        </div>

          {/* Manual installation section — apps that need user action */}
          {manualItems.length > 0 && !isApplying && (
            <div className="border-t border-border pt-4 space-y-3" data-testid="manual-install-section">
              <div className="text-sm font-medium text-foreground">
                Install manually
              </div>
              <div className="space-y-2">
                {manualItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg bg-warning/10 border border-warning/20 p-3 space-y-1.5"
                    data-testid={`manual-app-${item.id}`}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {item.name || item.id}
                    </div>
                    {item.manual?.instructions && (
                      <p className="text-xs text-muted-foreground">
                        {item.manual.instructions}
                      </p>
                    )}
                    {item.manual?.launch && (
                      <a
                        href={item.manual.launch}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open download page
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                After installing, run again to confirm and restore settings.
              </p>
            </div>
          )}

          {/* Settings (restore) section — only when restore data is present */}
          {restoreSummary && !isApplying && (
            <div className="border-t border-border pt-4 space-y-3" data-testid="restore-section">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Settings className="h-4 w-4" />
                Settings
              </div>
              <div className="space-y-2">
                {restoreSummary.restored > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                    <span className="text-sm font-medium">Restored</span>
                    <span className="text-xl font-semibold text-success">{restoreSummary.restored}</span>
                  </div>
                )}
                {restoreSummary.skipped > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-muted/20">
                    <span className="text-sm font-medium">Already up to date</span>
                    <span className="text-xl font-semibold text-muted-foreground">{restoreSummary.skipped}</span>
                  </div>
                )}
                {restoreSummary.failed > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-danger/10 border border-danger/20">
                    <span className="text-sm font-medium">Failed</span>
                    <span className="text-xl font-semibold text-danger">{restoreSummary.failed}</span>
                  </div>
                )}
              </div>
              {restoreSummary.backupLocation && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  <FolderArchive className="h-3 w-3 flex-shrink-0" />
                  <span>Backups: {restoreSummary.backupLocation}</span>
                </div>
              )}
            </div>
          )}

          {/* Details: unified single list with per-item action badges */}
          {items.length > 0 && !isApplying && showDetails && (
            <div className="border-t border-border pt-4">
              <DetailsDisclosure title={`Details (${activeFilters.size > 0 ? `${filteredItems.length} of ${items.length}` : items.length} apps)`}>
                <div className="space-y-1">
                  {/* Single unified list - actionable items shown first */}
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto pb-1">
                    {filteredItems.map((item, idx) => {
                      const badge = getActionBadge(item);
                      const isActionable = item.reason === 'would_install' || item.reason === 'installed' || item.reason === 'manual_required' || item.status === 'failed';
                      return (
                        <div 
                          key={`${item.id}-${idx}`} 
                          className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 ${isActionable ? 'bg-muted/10' : ''}`}
                        >
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono truncate flex-1 min-w-0" title={item.id}>{item.name || item.id}</span>
                          <span className="text-muted-foreground text-xs flex-shrink-0">({item.driver === 'manual' ? 'Manual' : item.driver})</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Copy diagnostics */}
                  <div className="flex justify-end pt-2">
                    <Button
                      ref={copyFeedback.buttonRef}
                      variant="ghost"
                      size="sm"
                      onClick={copyDiagnostics}
                      className="h-8 gap-2 relative"
                    >
                      <Copy className="h-3 w-3" />
                      Copy diagnostics
                      <InlineFeedbackPopover feedback={copyFeedback.feedback} />
                    </Button>
                  </div>
                </div>
              </DetailsDisclosure>
            </div>
          )}
        </div>

        {/* Sticky footer - always visible */}
        <DialogFooter className="flex-col gap-2 sm:flex-col flex-shrink-0 border-t border-border pt-4 bg-background">
          {/* Apply changes button - only in preview mode with pending changes */}
          {hasPendingChanges && onApplyChanges && (
            <Button 
              onClick={handleApplyClick} 
              className="w-full h-10"
              disabled={isApplying || applyClickedRef.current}
            >
              {isApplying ? 'Applying...' : 'Apply changes'}
            </Button>
          )}
          {/* Revert settings button — only after non-dry-run with restore data */}
          {!isDryRun && restoreSummary && restoreSummary.restored > 0 && onRevertSettings && (
            <Button
              variant="secondary"
              onClick={onRevertSettings}
              className="w-full h-10"
              disabled={isApplying}
            >
              Revert settings
            </Button>
          )}
          {/* Close/Cancel/Done button - disabled during apply */}
          <Button
            variant={hasPendingChanges && !isApplying ? "secondary" : "primary"}
            onClick={onClose}
            className="w-full h-10"
            disabled={isApplying}
          >
            {isApplying ? 'Please wait...' : hasPendingChanges ? 'Cancel' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

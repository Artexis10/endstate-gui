import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle, Copy, Package, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useMemo, useRef, useCallback } from 'react';
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
  const [copied, setCopied] = useState(false);
  
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

    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get action label and style for an item based on its reason and phase
  const getActionBadge = (item: ApplyItem): { label: string; className: string } => {
    // Map reason to user-friendly action label
    if (item.reason === 'would_install') {
      return { label: 'Will be installed', className: 'bg-warning/20 text-warning border-warning/30' };
    }
    if (item.reason === 'installed') {
      return { label: 'Installed this run', className: 'bg-success/20 text-success border-success/30' };
    }
    if (item.reason === 'already_installed' || item.reason === 'already_present') {
      return { label: 'Already present', className: 'bg-muted/20 text-muted-foreground border-muted/30' };
    }
    if (item.status === 'failed' || item.reason === 'failed') {
      return { label: 'Needs attention', className: 'bg-destructive/20 text-destructive border-destructive/30' };
    }
    if (item.reason === 'skipped' || item.reason === 'filtered') {
      return { label: 'Skipped', className: 'bg-muted/20 text-muted-foreground border-muted/30' };
    }
    // Fallback
    return { label: item.reason || 'Unknown', className: 'bg-muted/20 text-muted-foreground border-muted/30' };
  };

  // Sort items: actionable items first (will be installed, needs attention), then already present
  const sortedItems = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      'would_install': 0,
      'failed': 1,
      'installed': 2,
      'already_installed': 3,
      'already_present': 3,
      'skipped': 4,
      'filtered': 4,
    };
    return [...items].sort((a, b) => {
      const aPriority = priorityOrder[a.reason || ''] ?? 5;
      const bPriority = priorityOrder[b.reason || ''] ?? 5;
      return aPriority - bPriority;
    });
  }, [items]);

  // Total apps checked = all items in the list
  const totalChecked = items.length;

  // Determine title and description based on status and phase
  const getTitle = () => {
    if (isApplying) return 'Applying changes...';
    if (hasFailures) return 'Setup incomplete';
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
    if (hasFailures) {
      // Show checked vs needs attention
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
        className="sm:max-w-[500px] max-h-[85vh] flex flex-col"
        onEscapeKeyDown={isApplying ? (e) => e.preventDefault() : undefined}
        onPointerDownOutside={isApplying ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="flex-shrink-0">
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

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
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

          {/* Details: unified single list with per-item action badges */}
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
                <div className="mt-3 space-y-1">
                  {/* Single unified list - actionable items shown first */}
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                    {sortedItems.map((item, idx) => {
                      const badge = getActionBadge(item);
                      const isActionable = item.reason === 'would_install' || item.reason === 'installed' || item.status === 'failed';
                      return (
                        <div 
                          key={`${item.id}-${idx}`} 
                          className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 ${isActionable ? 'bg-muted/10' : ''}`}
                        >
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono truncate flex-1" title={item.id}>{item.id}</span>
                          <span className="text-muted-foreground text-xs flex-shrink-0">({item.driver})</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
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

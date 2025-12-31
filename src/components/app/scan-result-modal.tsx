import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Copy, Package, ChevronDown, ChevronRight } from 'lucide-react';
import type { VerifyItem } from '../../types';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';

interface ScanResultModalProps {
  open: boolean;
  onClose: () => void;
  okCount: number;
  missingCount: number;
  mismatchCount: number;
  items?: VerifyItem[];
  onFixApps: () => void;
}

// Group items by status and then by driver
function categorizeVerifyItems(items: VerifyItem[]): {
  ok: Record<string, VerifyItem[]>;
  missing: Record<string, VerifyItem[]>;
  versionMismatch: Record<string, VerifyItem[]>;
} {
  const result = {
    ok: {} as Record<string, VerifyItem[]>,
    missing: {} as Record<string, VerifyItem[]>,
    versionMismatch: {} as Record<string, VerifyItem[]>,
  };

  for (const item of items) {
    const driver = item.driver || 'unknown';
    if (item.status === 'ok') {
      if (!result.ok[driver]) result.ok[driver] = [];
      result.ok[driver].push(item);
    } else if (item.status === 'missing') {
      if (!result.missing[driver]) result.missing[driver] = [];
      result.missing[driver].push(item);
    } else if (item.status === 'version_mismatch') {
      if (!result.versionMismatch[driver]) result.versionMismatch[driver] = [];
      result.versionMismatch[driver].push(item);
    }
  }

  return result;
}

export function ScanResultModal({
  open,
  onClose,
  okCount,
  missingCount,
  mismatchCount,
  items = [],
  onFixApps,
}: ScanResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['missing', 'versionMismatch']));
  const copyFeedback = useMicroFeedback(2000);
  const hasIssues = missingCount > 0 || mismatchCount > 0;
  
  const categorized = useMemo(() => categorizeVerifyItems(items), [items]);
  
  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };
  
  // Count items per category from the items array
  const okItems = Object.values(categorized.ok).flat();
  const missingItems = Object.values(categorized.missing).flat();
  const mismatchItems = Object.values(categorized.versionMismatch).flat();

  const copyToClipboard = async () => {
    const lines: string[] = [];
    if (okItems.length > 0) {
      lines.push(`Up to date (${okItems.length}):`);
      okItems.forEach(a => lines.push(`  - ${a.id}`));
    }
    if (missingItems.length > 0) {
      lines.push(`\nMissing (${missingItems.length}):`);
      missingItems.forEach(a => lines.push(`  - ${a.id}`));
    }
    if (mismatchItems.length > 0) {
      lines.push(`\nVersion mismatch (${mismatchItems.length}):`);
      mismatchItems.forEach(a => lines.push(`  - ${a.id}${a.reason ? ` (${a.reason})` : ''}`));
    }

    await copyFeedback.triggerAsync(
      () => copyText(lines.join('\n')),
      'Copied',
      'Copy failed'
    );
  };

  // Render a categorized section with driver grouping
  const renderSection = (
    title: string,
    icon: string,
    groupedItems: Record<string, VerifyItem[]>,
    sectionKey: string,
    bgClass: string
  ) => {
    const itemCount = Object.values(groupedItems).flat().length;
    if (itemCount === 0) return null;

    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className={`rounded-lg border ${bgClass}`}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{icon} {title}</span>
            <span className="text-xs text-muted-foreground">({itemCount})</span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {Object.entries(groupedItems).map(([driver, driverItems]) => (
              <div key={driver} className="ml-6">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">{driver}</p>
                <div className="space-y-1">
                  {driverItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-background/50 text-xs">
                      <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 font-mono truncate">{item.id}</span>
                      {item.reason && (
                        <span className="text-muted-foreground text-[10px] truncate max-w-[120px]">{item.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {hasIssues ? (
              <AlertCircle className="h-8 w-8 text-warning" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
            <DialogTitle className="text-2xl">
              {hasIssues ? "We found a few things to fix" : "Your computer is ready"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {hasIssues
              ? "Some applications need to be installed or updated."
              : "Everything matches your setup."}
          </DialogDescription>
        </DialogHeader>

        {/* Summary counts */}
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Up to date</span>
            <span className="text-2xl font-semibold text-success">{okCount}</span>
          </div>
          
          {missingCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Missing</span>
              <span className="text-2xl font-semibold text-warning">{missingCount}</span>
            </div>
          )}
          
          {mismatchCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Version mismatch</span>
              <span className="text-2xl font-semibold text-warning">{mismatchCount}</span>
            </div>
          )}
        </div>

        {/* Details expander with categorized tree view */}
        {items.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showDetails ? 'Hide' : 'View'} details ({items.length} apps)
              </button>
              {showDetails && (
                <Button
                  ref={copyFeedback.buttonRef}
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-8 gap-2 relative"
                >
                  <Copy className="h-3 w-3" />
                  Copy list
                  <InlineFeedbackPopover feedback={copyFeedback.feedback} />
                </Button>
              )}
            </div>
            
            {showDetails && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {renderSection('Missing', '❌', categorized.missing, 'missing', 'border-warning/30 bg-warning/5')}
                {renderSection('Version mismatch', '⚠️', categorized.versionMismatch, 'versionMismatch', 'border-warning/30 bg-warning/5')}
                {renderSection('Up to date', '✅', categorized.ok, 'ok', 'border-success/30 bg-success/5')}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {hasIssues ? (
            <Button onClick={onFixApps} className="w-full">
              Install missing apps
            </Button>
          ) : (
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

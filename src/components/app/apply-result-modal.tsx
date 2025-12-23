import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle, Copy, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ApplyItem, ApplyCounts } from '../../types';

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

  const hasIssues = counts.failed > 0;
  const allUpToDate = counts.installed === 0 && counts.failed === 0 && counts.alreadyInstalled > 0;

  // Categorize items
  const installedItems = items.filter(i => i.status === 'ok' && (i.reason === 'installed' || i.reason === 'would_install'));
  const alreadyInstalledItems = items.filter(i => i.status === 'skipped' && i.reason === 'already_installed');
  const skippedFilteredItems = items.filter(i => i.status === 'skipped' && i.reason !== 'already_installed');
  const failedItems = items.filter(i => i.status === 'failed');

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  // Group items by driver
  const groupByDriver = (items: ApplyItem[]) => {
    return items.reduce((acc, item) => {
      const driver = item.driver || 'unknown';
      if (!acc[driver]) acc[driver] = [];
      acc[driver].push(item);
      return acc;
    }, {} as Record<string, ApplyItem[]>);
  };

  const copyDiagnostics = async () => {
    const diagnostics = [
      '=== Apply Diagnostics ===',
      `Installed: ${counts.installed}`,
      `Already installed: ${counts.alreadyInstalled}`,
      `Skipped (filtered): ${counts.skippedFiltered}`,
      `Failed: ${counts.failed}`,
      '',
      '--- Items ---',
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

  const renderSection = (
    title: string,
    icon: string,
    items: ApplyItem[],
    sectionKey: string,
    bgColor: string
  ) => {
    if (items.length === 0) return null;
    const isExpanded = expandedSections.has(sectionKey);
    const grouped = groupByDriver(items);

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
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </button>
        
        {isExpanded && (
          <div className="border-t border-border max-h-48 overflow-y-auto">
            {Object.entries(grouped).map(([driver, driverItems]) => (
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
              {hasIssues ? 'Setup complete with issues' : allUpToDate ? 'Your computer is ready' : 'Setup complete'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {hasIssues 
              ? `${counts.failed} app${counts.failed > 1 ? 's' : ''} need${counts.failed === 1 ? 's' : ''} attention`
              : allUpToDate 
                ? 'All apps are already installed and up to date'
                : 'All apps are ready to use'}
          </DialogDescription>
        </DialogHeader>

        {/* Non-technical summary */}
        <div className="space-y-3 py-4">
          {counts.installed > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <span className="text-sm font-medium">Installed</span>
              <span className="text-2xl font-semibold text-success">{counts.installed}</span>
            </div>
          )}
          
          {counts.alreadyInstalled > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <span className="text-sm font-medium">{allUpToDate ? 'Up to date' : 'Already installed'}</span>
              <span className="text-2xl font-semibold text-success">{counts.alreadyInstalled}</span>
            </div>
          )}
          
          {counts.skippedFiltered > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <span className="text-sm font-medium">Skipped</span>
              <span className="text-2xl font-semibold text-muted-foreground">{counts.skippedFiltered}</span>
            </div>
          )}
          
          {counts.failed > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-sm font-medium">Needs attention</span>
              <span className="text-2xl font-semibold text-destructive">{counts.failed}</span>
            </div>
          )}
        </div>

        {/* Details expander (technical) */}
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
                {renderSection('Installed', '✅', installedItems, 'installed', '')}
                {renderSection('Already installed', '⏭️', alreadyInstalledItems, 'already', '')}
                {renderSection('Skipped by filter', '⏭️', skippedFilteredItems, 'skipped', '')}
                {renderSection('Needs attention', '❌', failedItems, 'failed', 'bg-destructive/5')}
                
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
              Fix {counts.failed} issue{counts.failed > 1 ? 's' : ''}
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

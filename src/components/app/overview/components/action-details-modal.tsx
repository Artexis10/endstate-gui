/**
 * ActionDetailsModal - Shows detailed results for completed actions
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/lifecycle-state';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import type { ActionResult, ActionProgress } from '../types';

type ConfigStatus = 'captured' | 'errored';

type FilterValue = StatusKey | 'config' | null;

/**
 * Legacy heuristic: match a config module ID to an app ID by substring.
 * Used as fallback when engine does not provide configModules with appId.
 */
function configMatchesAppLegacy(configId: string, appId: string): boolean {
  const configWords = configId.toLowerCase().split('-');
  const appSegments = appId.split('.').map(s => s.toLowerCase());

  for (const word of configWords) {
    if (word.length < 3) continue;
    for (const segment of appSegments) {
      if (segment.includes(word) || word.includes(segment)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Build a map of appId → config statuses.
 * Prefers engine-provided configModules (with explicit appId) when available.
 * Falls back to legacy substring heuristic for older engines.
 */
function buildConfigMap(
  actionResult: ActionResult,
  appIds: string[],
): { matched: Map<string, { configId: string; status: ConfigStatus }[]>; unmatched: { id: string; status: ConfigStatus }[] } {
  const matched = new Map<string, { configId: string; status: ConfigStatus }[]>();
  const unmatched: { id: string; status: ConfigStatus }[] = [];

  // Prefer structured configModules (engine-provided appId)
  if (actionResult.configModules && actionResult.configModules.length > 0) {
    for (const mod of actionResult.configModules) {
      if (mod.status === 'skipped') continue;

      const configStatus: ConfigStatus = mod.status === 'error' ? 'errored' : 'captured';

      // Prefer exact match via wingetRefs, fallback to appId substring heuristic
      const matchedApp = (
        mod.wingetRefs?.length
          ? appIds.find(aid => mod.wingetRefs!.some(ref => ref.toLowerCase() === aid.toLowerCase()))
          : null
      ) ?? appIds.find(aid => {
        const segments = aid.toLowerCase().split('.');
        const modAppId = mod.appId.toLowerCase();
        return segments.some(seg => seg === modAppId || modAppId.includes(seg) || seg.includes(modAppId));
      });

      if (matchedApp) {
        const existing = matched.get(matchedApp) ?? [];
        existing.push({ configId: mod.id, status: configStatus });
        matched.set(matchedApp, existing);
      } else {
        unmatched.push({ id: mod.displayName || mod.id, status: configStatus });
      }
    }
    return { matched, unmatched };
  }

  // Fallback: legacy heuristic for engines without configModules
  const configsIncluded = actionResult.configsIncluded ?? [];
  const configsErrored = actionResult.configsCaptureErrors ?? [];
  const allConfigs: { id: string; status: ConfigStatus }[] = [
    ...configsIncluded.map(id => ({ id, status: 'captured' as const })),
    ...configsErrored.map(id => ({ id, status: 'errored' as const })),
  ];

  for (const config of allConfigs) {
    const matchedApp = appIds.find(appId => configMatchesAppLegacy(config.id, appId));
    if (matchedApp) {
      const existing = matched.get(matchedApp) ?? [];
      existing.push({ configId: config.id, status: config.status });
      matched.set(matchedApp, existing);
    } else {
      unmatched.push(config);
    }
  }

  return { matched, unmatched };
}

interface ActionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionResult: ActionResult | null;
  actionProgress: ActionProgress | null;
}

export function ActionDetailsModal({
  open,
  onOpenChange,
  actionResult,
  actionProgress,
}: ActionDetailsModalProps) {
  const [detailsFilter, setDetailsFilter] = useState<FilterValue>(null);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) setDetailsFilter(null); // Reset filter when closing
  };

  // Derive canonical statusKey for each event
  const deriveStatusKey = (e: AppEvent): StatusKey => {
    return e.statusKey || (
      e.action === 'OK' ? 'present' :
      e.action === 'Installed' ? 'installed' :
      e.action === 'Failed' ? 'failed' :
      e.action === 'Skipped' ? 'skipped' :
      e.action === 'Cancelled' ? 'cancelled' :
      e.action === 'Processing' ? 'installing' :
      e.action === 'To install' || e.action === 'Missing' ? 'to_install' :
      e.action === 'Captured' ? 'detected' :
      'skipped'
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" data-testid="action-details-modal">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {actionResult?.action === 'capture' && 'Capture Details'}
            {actionResult?.action === 'setup' && 'Setup Details'}
            {actionResult?.action === 'check' && 'Check Details'}
            {!actionResult?.action && 'Details'}
          </DialogTitle>
          <DialogDescription>
            {actionResult?.summary || actionProgress?.message || 'Action completed.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary info - fixed header section */}
        {actionResult && (
          <div className="flex-shrink-0 space-y-3 text-sm">
            {/* Profile and timestamp */}
            <div className="flex items-center justify-between text-muted-foreground">
              {actionResult.profile && (
                <span>Profile: <span className="text-foreground font-medium">{actionResult.profile}</span></span>
              )}
              {actionResult.timestamp && (
                <span>{formatRelativeTime(actionResult.timestamp)}</span>
              )}
            </div>
            
            {/* Filter pills - clickable to filter the list */}
            {actionResult.counts && (
              <div className="flex flex-wrap gap-2 text-xs" role="tablist" aria-label="Filter by status">
                {actionResult.counts.installed !== undefined && actionResult.counts.installed > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'installed'}
                    onClick={() => setDetailsFilter(detailsFilter === 'installed' ? null : 'installed')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'installed' ? 'ring-2 ring-success' : ''
                    } ${detailsFilter && detailsFilter !== 'installed' ? 'opacity-50' : ''} ${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                  >
                    Installed: {actionResult.counts.installed}
                  </button>
                )}
                {actionResult.counts.toInstall !== undefined && actionResult.counts.toInstall > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'to_install'}
                    onClick={() => setDetailsFilter(detailsFilter === 'to_install' ? null : 'to_install')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity whitespace-nowrap flex-shrink-0 ${
                      detailsFilter === 'to_install' ? `ring-2 ${getColorClasses('action').border}` : ''
                    } ${detailsFilter && detailsFilter !== 'to_install' ? 'opacity-50' : ''} ${getColorClasses('action').bg} ${getColorClasses('action').text}`}
                  >
                    To install: {actionResult.counts.toInstall}
                  </button>
                )}
                {actionResult.counts.alreadyPresent !== undefined && actionResult.counts.alreadyPresent > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'present'}
                    onClick={() => setDetailsFilter(detailsFilter === 'present' ? null : 'present')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'present' ? 'ring-2 ring-success' : ''
                    } ${detailsFilter && detailsFilter !== 'present' ? 'opacity-50' : ''} ${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                  >
                    Already present: {actionResult.counts.alreadyPresent}
                  </button>
                )}
                {actionResult.counts.skipped !== undefined && actionResult.counts.skipped > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'skipped'}
                    onClick={() => setDetailsFilter(detailsFilter === 'skipped' ? null : 'skipped')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'skipped' ? 'ring-2 ring-warning' : ''
                    } ${detailsFilter && detailsFilter !== 'skipped' ? 'opacity-50' : ''} ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                  >
                    Skipped: {actionResult.counts.skipped}
                  </button>
                )}
                {actionResult.counts.failed !== undefined && actionResult.counts.failed > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'failed'}
                    onClick={() => setDetailsFilter(detailsFilter === 'failed' ? null : 'failed')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'failed' ? 'ring-2 ring-danger' : ''
                    } ${detailsFilter && detailsFilter !== 'failed' ? 'opacity-50' : ''} ${getColorClasses('error').bg} ${getColorClasses('error').text}`}
                  >
                    Failed: {actionResult.counts.failed}
                  </button>
                )}
                {actionResult.counts.missing !== undefined && actionResult.counts.missing > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'to_install'}
                    onClick={() => setDetailsFilter(detailsFilter === 'to_install' ? null : 'to_install')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'to_install' ? `ring-2 ${getColorClasses('warn').border}` : ''
                    } ${detailsFilter && detailsFilter !== 'to_install' ? 'opacity-50' : ''} ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                  >
                    Missing: {actionResult.counts.missing}
                  </button>
                )}
                {actionResult.counts.configsCaptured !== undefined && actionResult.counts.configsCaptured > 0 && (
                  <button
                    role="tab"
                    aria-selected={detailsFilter === 'config'}
                    onClick={() => setDetailsFilter(detailsFilter === 'config' ? null : 'config')}
                    className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                      detailsFilter === 'config' ? 'ring-2 ring-violet-500/40' : ''
                    } ${detailsFilter && detailsFilter !== 'config' ? 'opacity-50' : ''} bg-violet-500/10 text-violet-600 dark:text-violet-400`}
                  >
                    Settings: {actionResult.counts.configsCaptured}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Unified list: app events with inline config badges */}
        {actionResult?.appEvents && actionResult.appEvents.length > 0 && (() => {
          // Filter out phase header events from the list
          const itemEvents = actionResult.appEvents.filter(e =>
            e.app !== '── APPLY ──' && e.app !== '── VERIFY ──'
          );

          // Build config → app matching map for capture results
          const hasConfigs = actionResult.action === 'capture' && actionResult.outputFormat === 'zip';
          const configMap = hasConfigs
            ? buildConfigMap(actionResult, itemEvents.map(e => e.app))
            : { matched: new Map<string, { configId: string; status: ConfigStatus }[]>(), unmatched: [] as { id: string; status: ConfigStatus }[] };

          // When filtering to config only, show only apps that have matched configs + unmatched
          const filteredEvents = (detailsFilter && detailsFilter !== 'config')
            ? itemEvents.filter(e => deriveStatusKey(e) === detailsFilter)
            : detailsFilter === 'config'
              ? itemEvents.filter(e => configMap.matched.has(e.app))
              : itemEvents;

          // Sort: failed/missing first, then to_install, then installed, then OK/skipped/others
          const sortedEvents = [
            ...filteredEvents.filter(e => e.statusKey === 'failed' || e.action === 'Failed'),
            ...filteredEvents.filter(e => (e.statusKey === 'to_install' && e.phase === 'verify') || e.action === 'Missing'),
            ...filteredEvents.filter(e => e.statusKey === 'to_install' && e.phase !== 'verify'),
            ...filteredEvents.filter(e => e.statusKey === 'installed' || e.action === 'Installed'),
            ...filteredEvents.filter(e => e.statusKey === 'present' || e.action === 'OK'),
            ...filteredEvents.filter(e => !['failed', 'to_install', 'installed', 'present'].includes(e.statusKey || '') && !['Failed', 'Missing', 'Installed', 'OK'].includes(e.action)),
          ];

          // Deduplicate sorted events
          const seenApps = new Set<string>();
          const uniqueSortedEvents = sortedEvents.filter(e => {
            if (seenApps.has(e.app)) return false;
            seenApps.add(e.app);
            return true;
          });

          // Unmatched configs shown as standalone rows (only when not filtering to a non-config status)
          const showUnmatched = !detailsFilter || detailsFilter === 'config';

          // Calculate totals
          const manifestTotal = actionResult.counts?.manifestTotal;
          const appCount = uniqueSortedEvents.length;

          return (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-shrink-0 mb-2">
                <p className="text-xs text-muted-foreground">
                  {manifestTotal !== undefined
                    ? `Apps (${appCount} of ${manifestTotal})`
                    : `Apps (${appCount})`}
                </p>
              </div>
              <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto rounded-md border border-border" data-testid="action-details-apps-list">
                <div className="divide-y divide-border">
                  {uniqueSortedEvents.map((event, i) => {
                    const statusKey = deriveStatusKey(event);
                    const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: event.phase, reason: event.reason });
                    const colors = getColorClasses(uiStatus.color);
                    const appConfigs = configMap.matched.get(event.app);

                    return (
                      <div key={`app-${i}`} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="font-mono truncate flex-1">{event.app}</span>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {appConfigs?.map(cfg => (
                            <span
                              key={cfg.configId}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                                cfg.status === 'captured'
                                  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                  : 'bg-danger/10 text-danger'
                              }`}
                              data-testid={`config-${cfg.status}`}
                              title={cfg.configId}
                            >
                              {cfg.status === 'captured' ? 'Settings' : 'Settings error'}
                            </span>
                          ))}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit ${colors.bg} ${colors.text}`}>
                            {uiStatus.longLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Unmatched config modules (no app match found) */}
                  {showUnmatched && configMap.unmatched.map(cfg => (
                    <div key={`cfg-${cfg.id}`} className="flex items-center justify-between px-3 py-2 text-xs" data-testid={`config-${cfg.status}`}>
                      <span className="font-mono truncate flex-1">{cfg.id}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit ${
                        cfg.status === 'captured'
                          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                          : 'bg-danger/10 text-danger'
                      }`}>
                        {cfg.status === 'captured' ? 'Settings' : 'Settings error'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Fallback if no app events */}
        {(!actionResult?.appEvents || actionResult.appEvents.length === 0) && actionResult?.status === 'success' && (
          <div className="flex-shrink-0 text-sm text-muted-foreground py-4 text-center" data-testid="action-details-fallback">
            {actionResult.action === 'capture' 
              ? (actionResult.counts?.total === 0
                  ? 'No applications were detected on this computer.'
                  : 'Apps were captured but the list is unavailable.')
              : 'Operation completed successfully.'}
          </div>
        )}
        
        {actionResult?.status === 'error' && (
          <div className="flex-shrink-0 text-sm py-4 text-center">
            {actionResult.counts?.failed && actionResult.counts.failed > 0 && (actionResult.counts.installed || actionResult.counts.alreadyPresent) ? (
              // Partial failure: show summary, not generic error
              <div className="text-warning">
                <p className="font-medium">Completed with issues</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {actionResult.counts.installed || 0} installed • {actionResult.counts.alreadyPresent || 0} already present • {actionResult.counts.failed} failed
                </p>
              </div>
            ) : (
              // Fatal error
              <p className="text-danger">An error occurred during the operation.</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-4 gap-2">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

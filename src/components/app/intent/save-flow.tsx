/**
 * SaveFlow - Stateless guided capture flow (ADR-001)
 *
 * Scan → curate → produce output → save dialog.
 * No in-GUI capture history. Session-scoped result display only.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, HardDrive, Loader2, CheckCircle2, XCircle, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';
import type { CaptureConfigModule } from '@/types';

type CapturePhase = 'idle' | 'scanning' | 'done' | 'error' | 'saving';

interface CaptureAppEntry {
  id: string;
  name?: string;
}

interface CaptureResult {
  count: number;
  draftText: string;
  apps: CaptureAppEntry[];
  /** Engine output path (zip or jsonc) - used for file copy on save */
  outputPath?: string;
  /** Engine output format: 'zip' or 'jsonc' */
  outputFormat?: 'zip' | 'jsonc';
  /** Config module IDs successfully captured into the bundle */
  configsIncluded?: string[];
  /** Structured config module metadata */
  configModules?: CaptureConfigModule[];
}

export interface SaveFlowProps {
  onBack: () => void;
  engineConnected: boolean;
  isRunning: boolean;
  captureProgress: { message: string; detail?: string } | null;
  liveAppEvents: AppEvent[];
  onStartCapture: () => Promise<CaptureResult>;
  onSaveToFile: (result: CaptureResult) => Promise<boolean>;
  /** Increment to reset internal state (used when parent keeps component mounted) */
  resetKey?: number;
  /** Called when the flow returns to idle (save completed, scan again, etc.) */
  onFlowReset?: () => void;
}

export function SaveFlow({
  onBack,
  engineConnected,
  isRunning,
  captureProgress,
  liveAppEvents,
  onStartCapture,
  onSaveToFile,
  resetKey,
  onFlowReset,
}: SaveFlowProps) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Reset internal state when resetKey changes (parent signals a fresh start)
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setPhase('idle');
      setResult(null);
      setErrorMessage('');
      setActiveFilters(new Set());
    }
  }, [resetKey]);
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Set());

  /** Filter captured apps based on active filter set (OR logic). */
  const filterApps = (apps: CaptureAppEntry[]) => {
    if (activeFilters.size === 0) return apps;
    return apps.filter(app => {
      for (const f of activeFilters) {
        if (f === 'settings' && settingsByApp.has(app.id)) return true;
        if (f === 'detected') return true;
      }
      return false;
    });
  };

  const handleStartScan = async () => {
    setPhase('scanning');
    setResult(null);
    setErrorMessage('');
    setActiveFilters(new Set());
    try {
      const captureResult = await onStartCapture();
      setResult(captureResult);
      setPhase('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Capture failed');
      setPhase('error');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setPhase('saving');
    try {
      const saved = await onSaveToFile(result);
      if (saved) {
        // Reset for another capture
        setPhase('idle');
        setResult(null);
        onFlowReset?.();
      } else {
        // User cancelled save dialog
        setPhase('done');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
      setPhase('error');
    }
  };

  const handleScanAgain = () => {
    setPhase('idle');
    setResult(null);
    setErrorMessage('');
    onFlowReset?.();
  };

  // Tail of live events for activity display (filter out phase separator headers)
  const recentEvents = liveAppEvents
    .filter((e) => e.app !== '── APPLY ──' && e.app !== '── VERIFY ──')
    .slice(-8);

  // Config modules with "captured" status (settings bundled into the zip).
  // Fall back to configsIncluded IDs when structured configModules aren't available.
  const capturedConfigs = (result?.configModules ?? []).filter(m => m.status === 'captured');
  const settingsToShow: { id: string; displayName: string; filesCaptured?: number; wingetRefs?: string[] }[] =
    capturedConfigs.length > 0
      ? capturedConfigs
      : (result?.configsIncluded ?? []).map(id => ({ id, displayName: id }));
  const settingsCount = settingsToShow.length;

  // Build lookup: winget ID → has captured settings (for inline icon on app row)
  const settingsByApp = new Set<string>();
  for (const mod of settingsToShow) {
    for (const ref of mod.wingetRefs ?? []) {
      settingsByApp.add(ref);
    }
  }

  // Build name lookup: winget ID → friendly display name
  // Sources: configModules (all, not just captured) provide displayName via wingetRefs
  const nameByAppId = new Map<string, string>();
  for (const mod of result?.configModules ?? []) {
    for (const ref of mod.wingetRefs ?? []) {
      nameByAppId.set(ref, mod.displayName);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={transition}
      className="min-h-[calc(100vh-4rem)]"
      data-testid="save-flow"
    >
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="save-flow-back"
        disabled={phase === 'scanning'}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-blue-500/10">
          <HardDrive className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Save this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scan your apps and settings, then save everything as a portable file
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Idle: Start scan */}
        {phase === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-blue-500/50">
              <CardContent className="py-12 px-6 text-center">
                <p className="text-muted-foreground">
                  Scan this computer to find installed apps and settings.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You'll be able to save the result as a portable file.
                </p>
                <Button
                  className="mt-6 bg-blue-600 hover:bg-blue-700 text-white ring-blue-600/30 hover:ring-blue-600/50"
                  onClick={handleStartScan}
                  disabled={!engineConnected || isRunning}
                  data-testid="save-flow-start-scan"
                >
                  Start scan
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Scanning: Progress display */}
        {phase === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-blue-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Scanning...</p>
                    {captureProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {captureProgress.message}
                      </p>
                    )}
                    {captureProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {captureProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live activity tail */}
                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || 'detected';
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'capture', reason: event.reason });
                      const colors = getColorClasses(uiStatus.color);
                      return (
                        <div
                          key={`${event.app}-${event.timestamp}-${i}`}
                          className="flex items-center gap-2 text-xs pt-0.5"
                        >
                          <span className={`w-16 text-right font-medium ${colors.text}`}>
                            {uiStatus.shortLabel}
                          </span>
                          <span className="truncate flex-1">
                            {event.name || formatAppIdentity(event.app)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Done: Result summary + Save */}
        {(phase === 'done' || phase === 'saving') && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-blue-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Scan complete</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Found {result.count} {result.count === 1 ? 'app' : 'apps'}
                      {(result.configsIncluded?.length ?? 0) > 0 && (
                        <> &middot; {result.configsIncluded!.length} {result.configsIncluded!.length === 1 ? 'setting' : 'settings'} captured</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Unified app + settings list */}
                {result.apps.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <button
                        onClick={clearFilters}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('detected').bg} ${getColorClasses('detected').text} ${activeFilters.size > 0 ? 'opacity-50' : ''}`}
                        aria-pressed={activeFilters.size === 0}
                      >
                        {result.apps.length} apps
                      </button>
                      {settingsCount > 0 && (
                        <button
                          onClick={() => toggleFilter('settings')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('settings') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('settings')}
                        >
                          {settingsCount} settings
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {filterApps(result.apps).map((app) => {
                        const colors = getColorClasses('detected');
                        const hasSettings = settingsByApp.has(app.id);
                        const displayLabel = app.name || nameByAppId.get(app.id) || formatAppIdentity(app.id);
                        return (
                          <div key={app.id} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>DETECTED</span>
                            <span className="w-4 flex-shrink-0 flex justify-center">
                              {hasSettings && (
                                <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                              )}
                            </span>
                            <span className="truncate">
                              <span>{displayLabel}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={phase === 'saving'}
                    className="bg-blue-600 hover:bg-blue-700 text-white ring-blue-600/30 hover:ring-blue-600/50"
                    data-testid="save-flow-save-file"
                  >
                    {phase === 'saving' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save file
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleScanAgain}
                    disabled={phase === 'saving'}
                  >
                    Scan again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-red-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Scan failed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleScanAgain}
                  className="mt-2"
                >
                  Try again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * SetupFlow - Import + apply flow (ADR-001)
 *
 * Presents a drop zone for zip/manifest import alongside a list of existing
 * profiles. Selecting a profile triggers the preview/apply flow inline.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, FolderOpen, RefreshCw, Loader2, CheckCircle2, XCircle, Play, Eye, Trash2, Settings2, RotateCcw, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';
import { DropZone } from './drop-zone';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import type { DiscoveredProfile } from '@/file-discovery';
import type { EndstateEnvelope, EndstateRevertData, RestoreIntent } from '@/types';
import type { EngineExecResult } from '@/lib/engine-exec';
import { RestoreIntentToggle } from '@/components/app/overview/components/restore-intent-toggle';
import { ConfigModuleSelector } from '@/components/app/overview/components/config-module-selector';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';
import type { ConfigModuleInfo } from '@/types';

type SetupPhase = 'browse' | 'previewing' | 'preview-done' | 'applying' | 'apply-done' | 'error'
  | 'undo-checking' | 'undo-confirm' | 'undo-empty' | 'undo-running' | 'undo-done' | 'undo-error';

/** Normalize a string for fuzzy matching: lowercase, + → plus, strip non-alphanumeric */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
}

function humanizeModuleId(id: string): string {
  return id
    .replace(/^apps\./, '')
    .replace(/-plus-plus/g, '++')
    .replace(/-plus/g, '+')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}

/** Config-only apps are synthesized from config modules with driver "manual". */
function isConfigOnlyApp(event: AppEvent): boolean {
  return event.driver === 'manual';
}

interface PreviewResult {
  installed: number;
  alreadyPresent: number;
  appEvents: AppEvent[];
  restoreModulesAvailable?: string[];
  /** Maps winget ID → config module name for apps with settings */
  configModuleMap?: Record<string, string>;
}

interface ApplyResult {
  installed: number;
  alreadyPresent: number;
  failed: number;
  skipped: number;
  appEvents: AppEvent[];
  /** Maps winget ID → config module name for apps with settings */
  configModuleMap?: Record<string, string>;
  configsRestored?: number;
  configsSkipped?: number;
  configsFailed?: number;
}

export interface SetupFlowProps {
  profiles: DiscoveredProfile[];
  onBack: () => void;
  onProfileSelect: (profile: DiscoveredProfile) => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onFileDrop: (files: File[]) => void;
  /** Native file browse (Tauri mode only) */
  onBrowse?: () => void;
  onDeleteProfile: (path: string, displayName: string) => void;
  // Apply flow props
  isRunning: boolean;
  setupProgress: { message: string; detail?: string } | null;
  liveAppEvents: AppEvent[];
  onPreview: (profile: DiscoveredProfile) => Promise<PreviewResult>;
  onApply: (profile: DiscoveredProfile, restoreOptions?: { restoreIntent: RestoreIntent; selectedModules?: string[] }) => Promise<ApplyResult>;
  // Undo settings flow
  onUndoDryRun?: () => Promise<EngineExecResult<EndstateEnvelope<EndstateRevertData>>>;
  onUndoExecute?: () => Promise<EngineExecResult<EndstateEnvelope<EndstateRevertData>>>;
  onUndoComplete?: (data: EndstateRevertData) => void;
  pendingUndo?: boolean;
  onPendingUndoConsumed?: () => void;
  /** Increment to reset internal state (used when parent keeps component mounted) */
  resetKey?: number;
  /** Called when the flow returns to browse (start over, etc.) */
  onFlowReset?: () => void;
}

export function SetupFlow({
  profiles,
  onBack,
  onProfileSelect,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onFileDrop,
  onBrowse,
  onDeleteProfile,
  isRunning,
  setupProgress,
  liveAppEvents,
  onPreview,
  onApply,
  onUndoDryRun,
  onUndoExecute,
  onUndoComplete,
  pendingUndo,
  onPendingUndoConsumed,
  resetKey,
  onFlowReset,
}: SetupFlowProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('browse');
  const [selectedProfile, setSelectedProfile] = useState<DiscoveredProfile | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [restoreIntent, setRestoreIntent] = useState<RestoreIntent>('apps-only');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  // Undo flow state
  const [undoDryRunData, setUndoDryRunData] = useState<EndstateRevertData | null>(null);
  const [undoExecuteData, setUndoExecuteData] = useState<EndstateRevertData | null>(null);
  const [undoError, setUndoError] = useState('');

  // Reset internal state when resetKey changes (parent signals a fresh start)
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setPhase('browse');
      setSelectedProfile(null);
      setPreviewResult(null);
      setApplyResult(null);
      setErrorMessage('');
      setActiveFilters(new Set());
      setRestoreIntent('apps-only');
      setSelectedModules([]);
      setUndoDryRunData(null);
      setUndoExecuteData(null);
      setUndoError('');
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

  /** Filter events based on active filter set (OR logic). */
  const filterEvents = (events: AppEvent[], configMap: Record<string, string>) => {
    // Always exclude phase separator headers
    const filtered = events.filter(e => e.app !== '── APPLY ──' && e.app !== '── VERIFY ──');
    if (activeFilters.size === 0) return filtered;
    return filtered.filter(event => {
      const statusKey: StatusKey = event.statusKey || 'skipped';
      for (const f of activeFilters) {
        if (f === 'settings' && event.app in configMap) return true;
        if (f === statusKey) return true;
      }
      return false;
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshProfiles();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectProfile = (profile: DiscoveredProfile) => {
    setSelectedProfile(profile);
    onProfileSelect(profile);
    // Auto-start preview when a profile is selected
    handlePreview(profile);
  };

  const handlePreview = async (profile: DiscoveredProfile) => {
    setPhase('previewing');
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    setActiveFilters(new Set());
    setRestoreIntent('apps-only');
    try {
      const result = await onPreview(profile);
      setPreviewResult(result);
      setPhase('preview-done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Preview failed');
      setPhase('error');
    }
  };

  const handleApply = async () => {
    if (!selectedProfile) return;
    const settingsCount = previewResult?.restoreModulesAvailable?.length ?? Object.keys(previewResult?.configModuleMap ?? {}).length;
    setPhase('applying');
    setApplyResult(null);
    setErrorMessage('');
    setActiveFilters(new Set());
    try {
      const result = await onApply(selectedProfile, settingsCount > 0 ? { restoreIntent, selectedModules } : undefined);
      setApplyResult(result);
      setPhase('apply-done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply failed');
      setPhase('error');
    }
  };

  const handleBackToProfiles = () => {
    setPhase('browse');
    setSelectedProfile(null);
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    setRestoreIntent('apps-only');
    setSelectedModules([]);
    setUndoDryRunData(null);
    setUndoExecuteData(null);
    setUndoError('');
    onFlowReset?.();
  };

  /** Start the undo checking flow — fires dry-run and transitions based on result */
  const handleStartUndo = async () => {
    if (!onUndoDryRun) return;
    setPhase('undo-checking');
    setUndoDryRunData(null);
    setUndoExecuteData(null);
    setUndoError('');
    try {
      const result = await onUndoDryRun();
      if (!result.success) {
        const combinedOutput = `${result.stdout ?? ''} ${result.stderr ?? ''} ${result.error.stderr ?? ''}`;
        if (/unknown command/i.test(combinedOutput)) {
          setUndoError('The installed CLI does not support undo. Please update or re-bootstrap endstate.');
        } else {
          const stderr = (result.stderr || result.error.stderr || '').trim();
          setUndoError(stderr || result.error.message);
        }
        setPhase('undo-error');
        return;
      }
      const envelope = result.envelope as EndstateEnvelope<EndstateRevertData>;
      const data = envelope.data;
      if (!data.revertedRestoreRunId) {
        setPhase('undo-empty');
        return;
      }
      setUndoDryRunData(data);
      setPhase('undo-confirm');
    } catch (err) {
      setUndoError(err instanceof Error ? err.message : String(err));
      setPhase('undo-error');
    }
  };

  /** Execute the undo operation */
  const handleExecuteUndo = async () => {
    if (!onUndoExecute) return;
    setPhase('undo-running');
    try {
      const result = await onUndoExecute();
      if (!result.success) {
        setUndoError(result.error.message);
        setPhase('undo-error');
        return;
      }
      const envelope = result.envelope as EndstateEnvelope<EndstateRevertData>;
      setUndoExecuteData(envelope.data);
      if (envelope.data.failCount > 0) {
        setUndoError(`Failed to undo ${envelope.data.failCount} of ${envelope.data.revertCount + envelope.data.skipCount + envelope.data.failCount} settings`);
        setPhase('undo-error');
      } else {
        setPhase('undo-done');
        onUndoComplete?.(envelope.data);
      }
    } catch (err) {
      setUndoError(err instanceof Error ? err.message : String(err));
      setPhase('undo-error');
    }
  };

  // Auto-start undo when triggered from Command Palette
  useEffect(() => {
    if (pendingUndo && onUndoDryRun) {
      handleStartUndo();
      onPendingUndoConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUndo]);

  // Tail of live events for activity display (filter out phase separator headers)
  const recentEvents = liveAppEvents
    .filter((e) => e.app !== '── APPLY ──' && e.app !== '── VERIFY ──')
    .slice(-8);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={transition}
      className="min-h-[calc(100vh-4rem)]"
      data-testid="setup-flow"
    >
      {/* Back navigation */}
      <button
        onClick={phase === 'browse' ? onBack : handleBackToProfiles}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="setup-flow-back"
        disabled={phase === 'previewing' || phase === 'applying' || phase === 'undo-checking' || phase === 'undo-running'}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {phase === 'browse' ? 'Back' : 'Back to profiles'}
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-green-500/10">
          <Download className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Set up this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {phase === 'browse'
              ? 'Import a saved setup or choose a profile to install your apps'
              : phase.startsWith('undo')
              ? 'Undo settings changes from your last setup'
              : `Setting up from ${selectedProfile?.displayName || selectedProfile?.name || 'profile'}`}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Browse: Drop zone + Profile list */}
        {phase === 'browse' && (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {/* Drop zone for import */}
            <div className="mb-8">
              <DropZone onFileDrop={onFileDrop} onBrowse={onBrowse} disabled={isRunning} />
            </div>

            {/* Profile list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">
                  {profiles.length > 0
                    ? `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'} available`
                    : 'No profiles found'}
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onOpenProfilesFolder}>
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    Open folder
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {onUndoDryRun && (
                    <Button variant="ghost" size="sm" onClick={handleStartUndo}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Undo changes
                    </Button>
                  )}
                </div>
              </div>

              {profiles.length > 0 ? (
                <div className="grid gap-3">
                  {profiles.map((profile) => (
                    <Card
                      key={profile.name}
                      className="cursor-pointer hover:border-green-500/50 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-500/50"
                      onClick={() => handleSelectProfile(profile)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectProfile(profile);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      data-testid={`profile-card-${profile.name}`}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {profile.displayName || profile.name}
                            </p>
                            {profile.displayName && profile.displayName !== profile.name && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {profile.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              tabIndex={-1}
                              className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProfile(profile.path, profile.displayName || profile.name);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              tabIndex={-1}
                            >
                              Select
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 px-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Drop a zip bundle or manifest file above, or place profile files
                      in your Profiles folder.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {/* Previewing: Progress display */}
        {phase === 'previewing' && (
          <motion.div
            key="previewing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Previewing changes...</p>
                    {setupProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {setupProgress.message}
                      </p>
                    )}
                    {setupProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {setupProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || (
                        event.action === 'OK' ? 'present' :
                        event.action === 'To install' ? 'to_install' :
                        event.action === 'Processing' ? 'installing' :
                        'skipped'
                      );
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'preview', reason: event.reason });
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

        {/* Preview done: Show results + Apply button */}
        {phase === 'preview-done' && previewResult && (() => {
          const configMap = previewResult.configModuleMap ?? {};
          const hasConfigMap = Object.keys(configMap).length > 0;
          const settingsCount = previewResult.restoreModulesAvailable?.length ?? Object.keys(configMap).length;
          // Active settings count reflects user's restore selection
          const activeSettingsCount = restoreIntent === 'apps-and-settings' ? selectedModules.length : 0;
          // Separate config-only synthesized apps from winget apps
          const configOnlyPresent = previewResult.appEvents.filter(e => isConfigOnlyApp(e) && (e.statusKey === 'present' || !e.statusKey)).length;
          const configOnlyToInstall = previewResult.appEvents.filter(e => isConfigOnlyApp(e) && e.statusKey === 'to_install').length;
          const adjustedInstalled = previewResult.installed - configOnlyToInstall;
          const adjustedPresent = previewResult.alreadyPresent - configOnlyPresent;
          const totalApps = adjustedInstalled + adjustedPresent;
          // Partition filtered events
          const allFilteredEvents = filterEvents(previewResult.appEvents, configMap);
          const wingetEvents = allFilteredEvents.filter(e => !isConfigOnlyApp(e));
          const configOnlyEvents = allFilteredEvents.filter(e => isConfigOnlyApp(e));
          const showConfigOnlySection = configOnlyEvents.length > 0 && (activeFilters.size === 0 || activeFilters.has('settings'));
          return (
          <motion.div
            key="preview-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Preview complete</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {adjustedInstalled > 0
                        ? `${adjustedInstalled} to install, ${adjustedPresent} already present`
                        : `All ${totalApps} apps already present`}
                      {activeSettingsCount > 0 && ` · ${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'} selected`}
                      {activeSettingsCount === 0 && settingsCount > 0 && ` · ${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'} available`}
                    </p>
                  </div>
                </div>

                {/* Activity summary */}
                {previewResult.appEvents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {totalApps > 0 && (
                        <button
                          onClick={clearFilters}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('detected').bg} ${getColorClasses('detected').text} ${activeFilters.size > 0 ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.size === 0}
                        >
                          {totalApps} {totalApps === 1 ? 'app' : 'apps'}
                        </button>
                      )}
                      {adjustedInstalled > 0 && (
                        <button
                          onClick={() => toggleFilter('to_install')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('action').bg} ${getColorClasses('action').text} ${activeFilters.size > 0 && !activeFilters.has('to_install') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('to_install')}
                        >
                          {adjustedInstalled} to install
                        </button>
                      )}
                      {adjustedPresent > 0 && (
                        <button
                          onClick={() => toggleFilter('present')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('present') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('present')}
                        >
                          {adjustedPresent} present
                        </button>
                      )}
                      {settingsCount > 0 && (
                        hasConfigMap ? (
                          <button
                            onClick={() => toggleFilter('settings')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('settings') ? 'opacity-50' : ''}`}
                            aria-pressed={activeFilters.has('settings')}
                          >
                            {activeSettingsCount > 0 ? `${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'}` : `${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'}`}
                          </button>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                            {activeSettingsCount > 0 ? `${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'}` : `${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'}`}
                          </span>
                        )
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {wingetEvents.map((event, i) => {
                        const statusKey: StatusKey = event.statusKey || (
                          event.action === 'OK' ? 'present' :
                          event.action === 'To install' ? 'to_install' :
                          'skipped'
                        );
                        const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'preview', reason: event.reason });
                        const colors = getColorClasses(uiStatus.color);
                        const hasSettings = event.app in configMap;
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                            <span className="w-4 flex-shrink-0 flex justify-center">
                              {hasSettings && (
                                <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                              )}
                            </span>
                            <span className="truncate">
                              {event.name || formatAppIdentity(event.app)}
                            </span>
                          </div>
                        );
                      })}
                      {/* Config-only synthesized apps — shown separately with gear icon */}
                      {showConfigOnlySection && (
                        <>
                          <div className="border-t mt-2 pt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Settings detected for:</p>
                          </div>
                          {configOnlyEvents.map((event, i) => (
                            <div key={`config-${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                              <span className="w-16 flex-shrink-0 flex justify-end">
                                <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                              </span>
                              <span className="w-4 flex-shrink-0" />
                              <span className="truncate">
                                {event.name || humanizeModuleId(event.app)}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {settingsCount > 0 && (
                  <div className="mt-4 space-y-3">
                    <RestoreIntentToggle
                      restoreIntent={restoreIntent}
                      onRestoreIntentChange={(intent) => {
                        setRestoreIntent(intent);
                        if (intent === 'apps-only') setSelectedModules([]);
                      }}
                      configModuleCount={settingsCount}
                    />
                    {restoreIntent === 'apps-and-settings' && (() => {
                      const configMap = previewResult.configModuleMap ?? {};
                      // Invert configModuleMap (wingetId → qualifiedModuleId) to (shortId → wingetId)
                      // configModuleMap values may be qualified like "apps.vscode" — strip prefix to match restoreModulesAvailable
                      const moduleToWinget = new Map<string, string>();
                      for (const [wingetId, qualifiedId] of Object.entries(configMap)) {
                        const shortId = qualifiedId.includes('.') ? qualifiedId.split('.').pop()! : qualifiedId;
                        moduleToWinget.set(shortId, wingetId);
                        moduleToWinget.set(qualifiedId, wingetId);
                      }
                      // Build wingetId → display name from app events (engine-provided name)
                      const wingetToName = new Map<string, string>();
                      for (const ev of previewResult.appEvents) {
                        if (ev.name) wingetToName.set(ev.app, ev.name);
                      }
                      // Build normalized winget product → wingetId for fuzzy matching
                      // (module IDs like "vlc" → product part of "VideoLAN.VLC" → "vlc")
                      const wingetByProduct = new Map<string, string>();
                      for (const ev of previewResult.appEvents) {
                        if (!ev.app.includes('.')) continue;
                        const product = ev.app.slice(ev.app.indexOf('.') + 1);
                        wingetByProduct.set(normalizeForMatch(product), ev.app);
                      }
                      const moduleIds = previewResult.restoreModulesAvailable ?? [...new Set([...moduleToWinget.keys()])];
                      const modules: ConfigModuleInfo[] = moduleIds.map(id => {
                        const wingetId = moduleToWinget.get(id);
                        if (wingetId && wingetToName.get(wingetId)) {
                          return { id, displayName: wingetToName.get(wingetId)!, entries: 0, files: [] };
                        }
                        const matchedWingetId = wingetByProduct.get(normalizeForMatch(id));
                        if (matchedWingetId) {
                          return { id, displayName: formatAppIdentity(matchedWingetId), entries: 0, files: [] };
                        }
                        return { id, displayName: humanizeModuleId(id), entries: 0, files: [] };
                      });
                      if (modules.length === 0) return null;
                      return (
                        <ConfigModuleSelector
                          modules={modules}
                          selectedModules={selectedModules}
                          onSelectionChange={setSelectedModules}
                        />
                      );
                    })()}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4">
                  {previewResult.installed > 0 && (
                    <Button
                      onClick={handleApply}
                      data-testid="setup-flow-apply"
                      className="bg-green-600 hover:bg-green-700 text-white ring-green-600/30 hover:ring-green-600/50"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Apply changes
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleBackToProfiles}>
                    Back to profiles
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          );
        })()}

        {/* Applying: Progress display */}
        {phase === 'applying' && (
          <motion.div
            key="applying"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Installing apps...</p>
                    {setupProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {setupProgress.message}
                      </p>
                    )}
                    {setupProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {setupProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || (
                        event.action === 'OK' ? 'present' :
                        event.action === 'Installed' ? 'installed' :
                        event.action === 'Failed' ? 'failed' :
                        event.action === 'Processing' ? 'installing' :
                        event.action === 'Skipped' ? 'skipped' :
                        'installing'
                      );
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'apply', reason: event.reason });
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

        {/* Apply done: Results */}
        {phase === 'apply-done' && applyResult && (
          <motion.div
            key="apply-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className={`border-l-2 ${applyResult.failed > 0 ? 'border-l-amber-500/50' : 'border-l-green-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  {applyResult.failed > 0 ? (
                    <XCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {applyResult.failed > 0 ? 'Setup completed with errors' : 'Setup complete'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(() => {
                        // Exclude config-only synthesized apps from install/present counts
                        const cfgOnlyPresent = applyResult.appEvents.filter(e => isConfigOnlyApp(e) && (e.statusKey === 'present' || !e.statusKey)).length;
                        const adjInstalled = applyResult.installed;
                        const adjPresent = applyResult.alreadyPresent - cfgOnlyPresent;
                        return `${adjInstalled} installed, ${adjPresent} already present`;
                      })()}
                      {applyResult.failed > 0 ? `, ${applyResult.failed} failed` : ''}
                      {(() => {
                        const restored = applyResult.configsRestored ?? 0;
                        const settingsFailed = applyResult.configsFailed ?? 0;
                        if (restored > 0 && settingsFailed === 0) return <> &middot; {restored} {restored === 1 ? 'setting' : 'settings'} restored</>;
                        if (restored > 0 && settingsFailed > 0) return <> &middot; {restored} {restored === 1 ? 'setting' : 'settings'} restored, {settingsFailed} failed</>;
                        if (settingsFailed > 0) return <> &middot; {settingsFailed} {settingsFailed === 1 ? 'setting' : 'settings'} failed</>;
                        // Fallback: show selected settings count (only when restore was requested)
                        if (restoreIntent === 'apps-and-settings' && selectedModules.length > 0) {
                          const count = selectedModules.length;
                          return <> &middot; {count} {count === 1 ? 'setting' : 'settings'} included</>;
                        }
                        return null;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Activity summary */}
                {applyResult.appEvents.length > 0 && (() => {
                  const fullConfigMap = applyResult.configModuleMap ?? {};
                  // Filter config map to only include entries for modules the user selected
                  const applyConfigMap = selectedModules.length > 0
                    ? Object.fromEntries(Object.entries(fullConfigMap).filter(([, qualifiedId]) => {
                        const shortId = qualifiedId.includes('.') ? qualifiedId.split('.').pop()! : qualifiedId;
                        return selectedModules.includes(shortId) || selectedModules.includes(qualifiedId);
                      }))
                    : (restoreIntent === 'apps-and-settings' ? fullConfigMap : {});
                  const applySettingsRestored = applyResult.configsRestored ?? 0;
                  const applySettingsFailed = applyResult.configsFailed ?? 0;
                  const applySettingsProcessed = applySettingsRestored + (applyResult.configsSkipped ?? 0) + applySettingsFailed;
                  // Fall back to selected modules count when restore counters are empty (only when restore was requested)
                  const configMapSettingsCount = restoreIntent === 'apps-and-settings' ? selectedModules.length : 0;
                  const applySettingsTotal = applySettingsProcessed > 0 ? applySettingsProcessed : configMapSettingsCount;
                  // Separate config-only synthesized apps from winget apps
                  const configOnlyCount = applyResult.appEvents.filter(e => isConfigOnlyApp(e)).length;
                  const totalApplyApps = applyResult.installed + applyResult.alreadyPresent + applyResult.failed + applyResult.skipped - configOnlyCount;
                  // Partition filtered events
                  const allApplyEvents = filterEvents(applyResult.appEvents, applyConfigMap);
                  const applyWingetEvents = allApplyEvents.filter(e => !isConfigOnlyApp(e));
                  const applyConfigOnlyEvents = allApplyEvents.filter(e => isConfigOnlyApp(e));
                  const showApplyConfigOnlySection = applyConfigOnlyEvents.length > 0 && (activeFilters.size === 0 || activeFilters.has('settings'));
                  return (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {totalApplyApps > 0 && (
                        <button
                          onClick={clearFilters}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('detected').bg} ${getColorClasses('detected').text} ${activeFilters.size > 0 ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.size === 0}
                        >
                          {totalApplyApps} {totalApplyApps === 1 ? 'app' : 'apps'}
                        </button>
                      )}
                      {applyResult.installed > 0 && (
                        <button
                          onClick={() => toggleFilter('installed')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('installed') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('installed')}
                        >
                          {applyResult.installed} installed
                        </button>
                      )}
                      {applyResult.alreadyPresent > 0 && (
                        <button
                          onClick={() => toggleFilter('present')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('present') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('present')}
                        >
                          {applyResult.alreadyPresent} present
                        </button>
                      )}
                      {applyResult.skipped > 0 && (
                        <button
                          onClick={() => toggleFilter('skipped')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('warn').bg} ${getColorClasses('warn').text} ${activeFilters.size > 0 && !activeFilters.has('skipped') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('skipped')}
                        >
                          {applyResult.skipped} skipped
                        </button>
                      )}
                      {applyResult.failed > 0 && (
                        <button
                          onClick={() => toggleFilter('failed')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('error').bg} ${getColorClasses('error').text} ${activeFilters.size > 0 && !activeFilters.has('failed') ? 'opacity-50' : ''}`}
                          aria-pressed={activeFilters.has('failed')}
                        >
                          {applyResult.failed} failed
                        </button>
                      )}
                      {applySettingsTotal > 0 && (
                        applySettingsProcessed > 0 ? (
                          <button
                            onClick={() => toggleFilter('settings')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${applySettingsFailed > 0 ? `${getColorClasses('warn').bg} ${getColorClasses('warn').text}` : `${getColorClasses('success').bg} ${getColorClasses('success').text}`} ${activeFilters.size > 0 && !activeFilters.has('settings') ? 'opacity-50' : ''}`}
                            aria-pressed={activeFilters.has('settings')}
                          >
                            {applySettingsRestored > 0 && applySettingsFailed === 0
                              ? `${applySettingsRestored} ${applySettingsRestored === 1 ? 'setting' : 'settings'} restored`
                              : applySettingsFailed > 0
                              ? `${applySettingsProcessed} ${applySettingsProcessed === 1 ? 'setting' : 'settings'} (${applySettingsFailed} failed)`
                              : `${applySettingsProcessed} ${applySettingsProcessed === 1 ? 'setting' : 'settings'}`
                            }
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleFilter('settings')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity ${getColorClasses('success').bg} ${getColorClasses('success').text} ${activeFilters.size > 0 && !activeFilters.has('settings') ? 'opacity-50' : ''}`}
                            aria-pressed={activeFilters.has('settings')}
                          >
                            {applySettingsTotal} {applySettingsTotal === 1 ? 'setting' : 'settings'}
                          </button>
                        )
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {applyWingetEvents.map((event, i) => {
                        const statusKey: StatusKey = event.statusKey || (
                          event.action === 'OK' ? 'present' :
                          event.action === 'Installed' ? 'installed' :
                          event.action === 'Failed' ? 'failed' :
                          event.action === 'Skipped' ? 'skipped' :
                          'installed'
                        );
                        const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'apply', reason: event.reason });
                        const colors = getColorClasses(uiStatus.color);
                        const hasSettings = (restoreIntent === 'apps-and-settings' && event.app in applyConfigMap) || event.app.startsWith('\u2699');
                        const settingsOk = statusKey !== 'failed';
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                            <span className="w-4 flex-shrink-0 flex justify-center">
                              {hasSettings && (
                                <Settings2 className={`h-3 w-3 ${settingsOk ? getColorClasses('success').text : getColorClasses('error').text} ${!settingsOk ? 'opacity-50' : ''}`} />
                              )}
                            </span>
                            <span className="truncate">
                              {event.name || formatAppIdentity(event.app)}
                            </span>
                          </div>
                        );
                      })}
                      {/* Config-only synthesized apps — shown separately with gear icon */}
                      {showApplyConfigOnlySection && (
                        <>
                          <div className="border-t mt-2 pt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Settings detected for:</p>
                          </div>
                          {applyConfigOnlyEvents.map((event, i) => (
                            <div key={`config-${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                              <span className="w-16 flex-shrink-0 flex justify-end">
                                <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                              </span>
                              <span className="w-4 flex-shrink-0" />
                              <span className="truncate">
                                {event.name || humanizeModuleId(event.app)}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  );
                })()}

                <div className="flex items-center gap-3 mt-6">
                  <Button variant="ghost" onClick={handleBackToProfiles}>
                    Back to profiles
                  </Button>
                  {onUndoDryRun && restoreIntent === 'apps-and-settings' && ((applyResult.configsRestored ?? 0) > 0 || Object.keys(applyResult.configModuleMap ?? {}).length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartUndo}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Undo settings
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Undo: Checking for changes */}
        {phase === 'undo-checking' && (
          <motion.div
            key="undo-checking"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-amber-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Checking for recent changes...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Looking for settings changes from your last setup
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Undo: Nothing to undo */}
        {phase === 'undo-empty' && (
          <motion.div
            key="undo-empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-muted-foreground/30">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Nothing to undo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No recent setup changes found. Undo only works after a setup that changed your settings.
                    </p>
                  </div>
                </div>
                <Button variant="ghost" onClick={handleBackToProfiles}>
                  Back to profiles
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Undo: Confirm */}
        {phase === 'undo-confirm' && undoDryRunData && (() => {
          const actionableItems = undoDryRunData.results.filter(
            (r) => r.status !== 'skip' && r.status !== 'skipped',
          );
          const actionableCount = actionableItems.length;
          return (
          <motion.div
            key="undo-confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-amber-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Undo settings changes</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {actionableCount} {actionableCount === 1 ? 'setting' : 'settings'} will be restored to how they were before your last setup
                    </p>
                  </div>
                </div>

                {actionableCount > 0 && (
                  <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
                    {actionableItems.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="flex items-center gap-2 text-xs pt-0.5"
                      >
                        <span className="text-muted-foreground">&middot;</span>
                        <span className="truncate font-medium">
                          {item.targetPath.split(/[\\/]/).pop() || item.targetPath}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-amber-500 mb-4">
                  Your current settings will be backed up first.
                </p>

                <DetailsDisclosure title="Details">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {actionableItems.map((item, idx) => (
                      <div key={`path-${idx}`} className="font-mono truncate" title={item.targetPath}>
                        {item.targetPath}
                      </div>
                    ))}
                    <div className="pt-1">
                      Restore run: <span className="font-mono">{undoDryRunData.revertedRestoreRunId}</span>
                    </div>
                    {undoDryRunData.backupLocation && (
                      <div>Backup to: <span className="font-mono truncate">{undoDryRunData.backupLocation}</span></div>
                    )}
                  </div>
                </DetailsDisclosure>

                <div className="flex items-center gap-3 mt-6">
                  <Button
                    onClick={handleExecuteUndo}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Undo
                  </Button>
                  <Button variant="ghost" onClick={handleBackToProfiles}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          );
        })()}

        {/* Undo: Running */}
        {phase === 'undo-running' && (
          <motion.div
            key="undo-running"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-amber-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Undoing changes...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Putting your settings back how they were
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Undo: Done */}
        {phase === 'undo-done' && undoExecuteData && (
          <motion.div
            key="undo-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Changes undone</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {undoExecuteData.revertCount} {undoExecuteData.revertCount === 1 ? 'setting' : 'settings'} restored successfully
                      {undoExecuteData.skipCount > 0 && ` · ${undoExecuteData.skipCount} skipped`}
                    </p>
                  </div>
                </div>
                <Button onClick={handleBackToProfiles}>
                  Done
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Undo: Error */}
        {phase === 'undo-error' && (
          <motion.div
            key="undo-error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className={`border-l-2 ${undoExecuteData ? 'border-l-amber-500/50' : 'border-l-red-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className={`h-5 w-5 ${undoExecuteData ? 'text-amber-500' : 'text-red-500'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {undoExecuteData ? 'Completed with errors' : 'Something went wrong'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {undoError}
                    </p>
                  </div>
                </div>
                {undoExecuteData && (
                  <div className="space-y-1 mb-4 text-xs">
                    {undoExecuteData.revertCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-medium">Undone</span>
                        <span>{undoExecuteData.revertCount}</span>
                      </div>
                    )}
                    {undoExecuteData.failCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-medium">Failed</span>
                        <span>{undoExecuteData.failCount}</span>
                      </div>
                    )}
                  </div>
                )}
                <Button variant="ghost" onClick={handleBackToProfiles}>
                  Back to profiles
                </Button>
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
                    <p className="text-sm font-medium">Something went wrong</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" onClick={handleBackToProfiles} className="mt-2">
                  Back to profiles
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

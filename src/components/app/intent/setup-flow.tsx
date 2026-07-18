/**
 * SetupFlow - Import + apply flow (ADR-001)
 *
 * Presents a drop zone for zip/manifest import alongside a list of existing
 * profiles. Selecting a profile triggers the preview/apply flow inline.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, FolderOpen, RefreshCw, Loader2, CheckCircle2, XCircle, Play, Eye, Trash2, Settings2, RotateCcw, Info, Cloud } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterChip } from '@/components/ui/filter-chip';
import { NavButton } from '@/components/ui/nav-button';
import { Card, CardContent } from '@/components/ui/card';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';
import { DropZone } from './drop-zone';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import type { DiscoveredProfile } from '@/file-discovery';
import type {
  ApplyRestoreOptions,
  BackupListItem,
  CommandWarning,
  ConfigResolution,
  ConfigResolutionSummary,
  EndstateApplyData,
  EndstateError,
  EndstateEnvelope,
  EndstateRevertData,
  RestoreIntent,
  RestoreModuleRef,
  RestoreTargetMapping,
} from '@/types';
import type { EngineExecResult } from '@/lib/engine-exec';
import type { ConfigProgressEvent } from '@/lib/streaming-events';
import { RestoreIntentToggle } from '@/components/app/overview/components/restore-intent-toggle';
import { ConfigModuleSelector } from '@/components/app/overview/components/config-module-selector';
import { ConfigResolutionList } from './config-resolution-list';
import { ConfigMigrationProgress } from './config-migration-progress';
import { EngineEnvelopeError } from '@/lib/engine-envelope-error';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';
import type { ConfigModuleInfo, SubscriptionStatus } from '@/types';
import { HostedBackupChip } from '@/components/app/backup/hosted-backup-chip';
import { ProfileCloudBadge } from '@/components/app/backup/profile-cloud-badge';
import { profileKeyFor } from '@/lib/profile-key';
import { ProfileStorageChip } from '@/components/app/backup/profile-storage-chip';
import { CommandWarningList } from '@/components/app/command-warning-list';

type SetupPhase = 'browse' | 'previewing' | 'preview-done' | 'applying' | 'apply-done' | 'error'
  | 'undo-checking' | 'undo-confirm' | 'undo-empty' | 'undo-running' | 'undo-done' | 'undo-error';

/** Normalize a string for fuzzy matching: lowercase, + → plus, strip non-alphanumeric */
/** Config-only apps are synthesized from config modules with driver "manual". */
function isConfigOnlyApp(event: AppEvent): boolean {
  return event.driver === 'manual';
}

interface PreviewResult {
  success?: boolean;
  error?: EndstateError | null;
  installed: number;
  alreadyPresent: number;
  appEvents: AppEvent[];
  /**
   * Envelope actions from the dry-run preview. Each action carries the
   * manifest app `id` (the value `apply --only` matches on) alongside the
   * winget `ref` the streamed item events are keyed by. Optional so older
   * callers/tests without envelope data keep working — the per-app picker
   * simply stays dark without it.
   */
  actions?: EndstateApplyData['actions'];
  restoreModulesAvailable?: RestoreModuleRef[];
  /** Maps winget ID → config module name for apps with settings */
  configModuleMap?: Record<string, string>;
  configResolutions?: ConfigResolution[];
  configResolutionSummary?: ConfigResolutionSummary;
  warnings?: CommandWarning[];
}

/**
 * Derive the picker's selectable set from preview envelope actions: apps with
 * a manifest `id` AND a winget `ref` (installable rows). Ref-less actions are
 * manual/config-only apps — they are governed by the restore-intent controls,
 * not the picker, and are always kept in a subset run (see buildOnlyAppIds).
 */
function selectablePickerIds(actions: EndstateApplyData['actions']): string[] {
  return (actions ?? []).filter((a) => a.id && a.ref).map((a) => a.id!);
}

/**
 * Subset mode is only safe when every installable action carries a manifest
 * id. An action with a `ref` but no `id` cannot be expressed in `--only`, so
 * a subset run would silently skip that app — fall back to a full apply
 * instead of dropping it. (The engine always sets ids today; this guards the
 * boundary against future envelope shapes.)
 */
function hasUnmappableInstallable(actions: EndstateApplyData['actions']): boolean {
  return (actions ?? []).some((a) => a.ref && !a.id);
}

function isSelectedConfigModule(moduleId: string, selectedModules: string[]): boolean {
  const selectionKey = moduleId.startsWith('apps.') ? moduleId.slice('apps.'.length) : moduleId;
  return selectedModules.some((selectedModule) => {
    const selectedKey = selectedModule.startsWith('apps.')
      ? selectedModule.slice('apps.'.length)
      : selectedModule;
    return selectedModule === moduleId || selectedKey === selectionKey;
  });
}

function selectedCaptureIds(
  resolutions: ConfigResolution[] | undefined,
  selectedModules: string[],
): Set<string> {
  return new Set(
    (resolutions ?? [])
      .filter((resolution) => isSelectedConfigModule(resolution.moduleId, selectedModules))
      .map((resolution) => resolution.captureId),
  );
}

function moduleDisplayNameMap(
  moduleRefs: RestoreModuleRef[] | undefined,
): Record<string, string> {
  const displayNames: Record<string, string> = {};
  for (const moduleRef of moduleRefs ?? []) {
    const displayName = moduleRef.displayName?.trim();
    if (!displayName) continue;

    const shortId = moduleRef.id.startsWith('apps.')
      ? moduleRef.id.slice('apps.'.length)
      : moduleRef.id;
    const qualifiedId = `apps.${shortId}`;

    // A fallback displayName equal to an engine ID is provenance, not friendly
    // copy. Keep that value in Details instead of leaking it into the distilled row.
    if (displayName === moduleRef.id || displayName === shortId || displayName === qualifiedId) {
      continue;
    }

    displayNames[moduleRef.id] = displayName;
    displayNames[shortId] = displayName;
    displayNames[qualifiedId] = displayName;
  }
  return displayNames;
}

/**
 * Build the `--only` id list for a subset apply, in envelope action order:
 * the SELECTED winget app ids plus ALL manual/config-only app ids. Manual ids
 * are always included so the "Settings only" section and restore-intent
 * composition behave exactly as an unfiltered run.
 *
 * Note: deselecting a winget app also removes its matched config modules from
 * the engine's restore scope (subset apply = subset restore), even if that
 * module is still checked in the module selector — the engine matches modules
 * against the filtered app set.
 */
function buildOnlyAppIds(actions: EndstateApplyData['actions'], selected: Set<string>): string[] {
  const out: string[] = [];
  for (const a of actions ?? []) {
    if (!a.id) continue;
    if (a.ref) {
      if (selected.has(a.id)) out.push(a.id);
    } else {
      out.push(a.id);
    }
  }
  return out;
}

interface ApplyResult {
  success?: boolean;
  installed: number;
  alreadyPresent: number;
  failed: number;
  skipped: number;
  appEvents: AppEvent[];
  /** Maps winget ID → config module name for apps with settings */
  configModuleMap?: Record<string, string>;
  restoreModulesAvailable?: RestoreModuleRef[];
  configsRestored?: number;
  configsSkipped?: number;
  configsFailed?: number;
  configResolutions?: ConfigResolution[];
  configResolutionSummary?: ConfigResolutionSummary;
  warnings?: CommandWarning[];
  error?: EndstateError | null;
}

export interface SetupFlowProps {
  profiles: DiscoveredProfile[];
  /** Newly imported profile that should open directly in setup review. */
  profileToOpen?: DiscoveredProfile | null;
  /** Clears the one-shot imported profile handoff after it is consumed. */
  onProfileToOpenConsumed?: () => void;
  /** Fires after the imported profile preview is committed to the review UI. */
  onProfileToOpenPreviewed?: (profile: DiscoveredProfile) => void;
  /** Fires after an imported profile preview failure is committed to the UI. */
  onProfileToOpenPreviewFailed?: (profile: DiscoveredProfile, error: Error) => void;
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
  liveConfigEvents?: ConfigProgressEvent[];
  onPreview: (profile: DiscoveredProfile) => Promise<PreviewResult>;
  /**
   * `onlyAppIds` is present ONLY when the per-app picker is active and the
   * user selected a strict subset — the caller passes them as
   * `apply --only <ids>`. All-selected (or picker dark) omits the field so
   * the invocation is identical to today.
   */
  onApply: (profile: DiscoveredProfile, options?: ApplyRestoreOptions) => Promise<ApplyResult>;
  /** Capability gate for explicit `apply --restore-target` mappings. */
  restoreTargetSupported?: boolean;
  /**
   * Per-app picker capability gate: true only when the engine advertises
   * `apply --only` (see engineSupportsApplyOnly). False → the preview renders
   * exactly as before, with no checkboxes and no selection affordances.
   */
  applyOnlySupported?: boolean;
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
  /**
   * Map of profileKey (the profile's path) → its hosted backup, derived from
   * `profileBackupIds` verified against `backup list` BY ID (never by name).
   * A profile card whose key is present gets the cloud badge + "Backed up · N
   * versions · M ago" subtitle; absent (or a stale/deleted id) → "Local only".
   * Pass `undefined` (or an empty map) to hide cloud state entirely.
   */
  cloudBackupIndex?: Map<string, BackupListItem>;
  /** Hosted-backup capability gate. False → hide the chip entirely. */
  hostedBackupSupported?: boolean;
  /** Whether the user is signed in to Hosted Backup. */
  hostedBackupSignedIn?: boolean;
  /** Current subscription status, if known. */
  hostedBackupSubscriptionStatus?: SubscriptionStatus;
  /** Routes to the Backup pane (sidebar). The chip click handler uses this. */
  onOpenHostedBackup?: () => void;
  /** Opens the cold-start restore wizard (cloud → local profile). Visible as
   *  a prominent CTA above the drop zone whenever the user is signed in to
   *  Hosted Backup and has at least one cloud backup. Closes the new-machine
   *  discoverability gap — without it, a fresh install with no local profiles
   *  but a paid subscription has no obvious path to pull from the cloud. */
  onRestoreFromCloud?: () => void;
  /** Push a local-only profile up to the cloud as a new backup. The card
   *  surfaces a "Back up to cloud" link on local-only rows so the user can
   *  cloud-protect any locally-captured profile without leaving the Setup
   *  screen. Only rendered when the user is signed in + subscription is
   *  active + the profile is not already in `cloudBackupIndex`. */
  onPushProfileToCloud?: (profilePath: string, profileName: string) => void;
}

export function SetupFlow({
  profiles,
  profileToOpen,
  onProfileToOpenConsumed,
  onProfileToOpenPreviewed,
  onProfileToOpenPreviewFailed,
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
  liveConfigEvents = [],
  onPreview,
  onApply,
  applyOnlySupported = false,
  restoreTargetSupported = false,
  onUndoDryRun,
  onUndoExecute,
  onUndoComplete,
  pendingUndo,
  onPendingUndoConsumed,
  resetKey,
  onFlowReset,
  cloudBackupIndex,
  hostedBackupSupported = false,
  hostedBackupSignedIn = false,
  hostedBackupSubscriptionStatus,
  onOpenHostedBackup,
  onRestoreFromCloud,
  onPushProfileToCloud,
}: SetupFlowProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('browse');
  const [selectedProfile, setSelectedProfile] = useState<DiscoveredProfile | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorRemediation, setErrorRemediation] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [restoreIntent, setRestoreIntent] = useState<RestoreIntent>('apps-only');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [restoreTargets, setRestoreTargets] = useState<RestoreTargetMapping[]>([]);
  // Per-app picker selection: manifest app ids currently INCLUDED in the run.
  // Initialized to the full selectable set when a preview completes (default
  // all checked). Presentation-only — planning stays in the engine.
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  // Undo flow state
  const [undoDryRunData, setUndoDryRunData] = useState<EndstateRevertData | null>(null);
  const [undoExecuteData, setUndoExecuteData] = useState<EndstateRevertData | null>(null);
  const [undoError, setUndoError] = useState('');
  const importedPreviewRef = useRef<{
    profile: DiscoveredProfile;
    error?: Error;
  } | null>(null);
  const previewModuleDisplayNames = moduleDisplayNameMap(
    previewResult?.restoreModulesAvailable,
  );
  const applyModuleDisplayNames = moduleDisplayNameMap(
    applyResult?.restoreModulesAvailable?.length
      ? applyResult.restoreModulesAvailable
      : previewResult?.restoreModulesAvailable,
  );

  // Reset internal state when resetKey changes (parent signals a fresh start)
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setPhase('browse');
      setSelectedProfile(null);
      setPreviewResult(null);
      setApplyResult(null);
      setErrorMessage('');
      setErrorRemediation(null);
      setActiveFilters(new Set());
      setRestoreIntent('apps-only');
      setSelectedModules([]);
      setRestoreTargets([]);
      setSelectedAppIds(new Set());
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
    // Exclude phase separator headers and raw config copy operations (internal engine detail)
    const filtered = events.filter(e =>
      e.app !== '── APPLY ──' && e.app !== '── VERIFY ──' && !e.app.startsWith('copy:')
    );
    if (activeFilters.size === 0) return filtered;
    return filtered.filter(event => {
      const statusKey: StatusKey = event.statusKey || 'skipped';
      for (const f of activeFilters) {
        if (f === 'settings' && (event.app in configMap || isConfigOnlyApp(event))) return true;
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

  const handleSelectProfile = (profile: DiscoveredProfile, imported = false) => {
    setSelectedProfile(profile);
    onProfileSelect(profile);
    if (imported) importedPreviewRef.current = { profile };
    // Auto-start preview when a profile is selected
    handlePreview(profile);
  };

  const handlePreview = async (profile: DiscoveredProfile) => {
    setPhase('previewing');
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    setErrorRemediation(null);
    setActiveFilters(new Set());
    setRestoreIntent('apps-only');
    setSelectedModules([]);
    setRestoreTargets([]);
    try {
      const result = await onPreview(profile);
      setPreviewResult(result);
      // Picker default: everything checked (identical to an unfiltered apply).
      setSelectedAppIds(new Set(selectablePickerIds(result.actions)));
      setPhase('preview-done');
    } catch (err) {
      const previewError = err instanceof Error ? err : new Error('Preview failed');
      if (importedPreviewRef.current?.profile.path === profile.path) {
        importedPreviewRef.current.error = previewError;
      }
      setErrorMessage(previewError.message);
      setErrorRemediation(err instanceof EngineEnvelopeError ? err.remediation ?? null : null);
      setPhase('error');
    }
  };

  useEffect(() => {
    const importedPreview = importedPreviewRef.current;
    if (!importedPreview) return;

    if (phase === 'preview-done' && previewResult) {
      importedPreviewRef.current = null;
      onProfileToOpenPreviewed?.(importedPreview.profile);
    } else if (phase === 'error' && importedPreview.error) {
      importedPreviewRef.current = null;
      onProfileToOpenPreviewFailed?.(importedPreview.profile, importedPreview.error);
    }
  }, [phase, previewResult, onProfileToOpenPreviewed, onProfileToOpenPreviewFailed]);

  useEffect(() => {
    if (!profileToOpen) return;
    onProfileToOpenConsumed?.();
    handleSelectProfile(profileToOpen, true);
    // The profile object is a one-shot handoff. Re-running because callback
    // identities changed would start the engine preview twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileToOpen]);

  const handleApply = async () => {
    if (!selectedProfile) return;
    const settingsCount = previewResult?.restoreModulesAvailable?.length ?? Object.keys(previewResult?.configModuleMap ?? {}).length;
    // Per-app subset: only when the engine advertises --only AND the user
    // deselected at least one app. All-selected omits the field entirely so
    // the apply invocation is byte-identical to a picker-less run.
    const pickerIds = selectablePickerIds(previewResult?.actions);
    const selectedCount = pickerIds.filter((id) => selectedAppIds.has(id)).length;
    const unmappable = hasUnmappableInstallable(previewResult?.actions);
    if (unmappable && applyOnlySupported) {
      console.warn('[setup-flow] installable action without a manifest id in preview; per-app subset disabled for this apply');
    }
    const subsetActive = applyOnlySupported && !unmappable && pickerIds.length > 0 && selectedCount < pickerIds.length;
    const allowedCaptureIds = selectedCaptureIds(previewResult?.configResolutions, selectedModules);
    const relevantRestoreTargets = restoreTargets.filter(
      (mapping) => allowedCaptureIds.has(mapping.captureId),
    );
    const explicitRestoreTargets = restoreIntent === 'apps-and-settings'
      && selectedModules.length > 0
      && relevantRestoreTargets.length > 0
      ? relevantRestoreTargets
      : undefined;
    const restoreOpts: ApplyRestoreOptions | undefined = settingsCount > 0
      ? {
          restoreIntent,
          selectedModules,
          ...(explicitRestoreTargets ? { restoreTargets: explicitRestoreTargets } : {}),
        }
      : undefined;
    const options = subsetActive
      ? { ...(restoreOpts ?? {}), onlyAppIds: buildOnlyAppIds(previewResult?.actions, selectedAppIds) }
      : restoreOpts;
    setPhase('applying');
    setApplyResult(null);
    setErrorMessage('');
    setErrorRemediation(null);
    setActiveFilters(new Set());
    try {
      const result = await onApply(selectedProfile, options);
      setApplyResult(result);
      setPhase('apply-done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply failed');
      setErrorRemediation(err instanceof EngineEnvelopeError ? err.remediation ?? null : null);
      setPhase('error');
    }
  };

  const handleBackToProfiles = () => {
    setPhase('browse');
    setSelectedProfile(null);
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    setErrorRemediation(null);
    setRestoreIntent('apps-only');
    setSelectedModules([]);
    setRestoreTargets([]);
    setSelectedAppIds(new Set());
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
      <NavButton
        onClick={phase === 'browse' ? onBack : handleBackToProfiles}
        className="mb-6"
        data-testid="setup-flow-back"
        disabled={phase === 'previewing' || phase === 'applying' || phase === 'undo-checking' || phase === 'undo-running'}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {phase === 'browse' ? 'Back' : 'Back to profiles'}
      </NavButton>

      {/* Flow header */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
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
        {phase === 'browse' && onOpenHostedBackup && (
          <HostedBackupChip
            hostedBackupSupported={hostedBackupSupported}
            signedIn={hostedBackupSignedIn}
            subscriptionStatus={hostedBackupSubscriptionStatus}
            onOpen={onOpenHostedBackup}
          />
        )}
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
            {/* Hosted Backup restore CTA — only when the user is signed in and
                has at least one cloud backup. Sits above the drop zone so the
                new-machine path ("I paid for cloud backup, now where is it?")
                is the first thing the user sees rather than a discoverability
                puzzle through the chip. */}
            {hostedBackupSignedIn &&
              onRestoreFromCloud &&
              cloudBackupIndex &&
              cloudBackupIndex.size > 0 && (
                <Card
                  className="mb-4 cursor-pointer border-primary/30 bg-primary/5 hover:border-primary/60 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  onClick={() => !isRunning && onRestoreFromCloud()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isRunning) {
                      e.preventDefault();
                      onRestoreFromCloud();
                    }
                  }}
                  tabIndex={isRunning ? -1 : 0}
                  role="button"
                  aria-label="Restore from your Hosted Backup"
                  data-testid="setup-restore-from-cloud-cta"
                >
                  <CardContent className="py-4 px-5 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                      <Cloud className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Restore from your Hosted Backup
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cloudBackupIndex.size === 1
                          ? '1 backup available in the cloud — pull it to this machine.'
                          : `${cloudBackupIndex.size} backups available in the cloud — pick one to pull.`}
                      </p>
                    </div>
                    <Download className="h-4 w-4 text-primary" aria-hidden="true" />
                  </CardContent>
                </Card>
              )}

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
                  {profiles.map((profile) => {
                    const cloudEntry = cloudBackupIndex?.get(profileKeyFor(profile));
                    const showSecondaryName =
                      !!profile.displayName && profile.displayName !== profile.name;
                    return (
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
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="text-sm font-medium truncate leading-5">
                                {profile.displayName || profile.name}
                              </p>
                              <ProfileStorageChip
                                cloudEntry={cloudEntry}
                                testId={`profile-card-${profile.name}-storage-chip`}
                              />
                            </div>
                            {showSecondaryName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {profile.name}
                              </p>
                            )}
                            {cloudEntry && (
                              <p className="mt-1">
                                <ProfileCloudBadge
                                  cloudEntry={cloudEntry}
                                  variant="detailed"
                                  testId={`profile-card-${profile.name}-cloud-badge`}
                                />
                              </p>
                            )}
                            {!cloudEntry &&
                              hostedBackupSignedIn &&
                              hostedBackupSubscriptionStatus === 'active' &&
                              onPushProfileToCloud && (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="inline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // First host labels the cloud backup with what
                                    // this row shows — the user-set displayName
                                    // when present, the file name otherwise.
                                    onPushProfileToCloud(
                                      profile.path,
                                      profile.displayName || profile.name,
                                    );
                                  }}
                                  className="mt-1 gap-1 text-xs"
                                  data-testid={`profile-card-${profile.name}-push-to-cloud`}
                                >
                                  <Cloud className="h-3 w-3" aria-hidden="true" />
                                  Back up to cloud
                                </Button>
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
                    );
                  })}
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
          // Per-app picker (capability-gated). Selection re-slices the
          // engine-reported plan counts client-side — presentation only, no
          // planning logic. Dark (pickerEnabled false) → display counts are
          // exactly the adjusted envelope counts, byte-identical to before.
          const pickerActions = previewResult.actions ?? [];
          const pickerIds = selectablePickerIds(pickerActions);
          const pickerEnabled = applyOnlySupported && pickerIds.length > 0;
          const pickerSelectedCount = pickerIds.filter((id) => selectedAppIds.has(id)).length;
          const manifestIdByEventKey = new Map<string, string>();
          if (pickerEnabled) {
            for (const a of pickerActions) {
              if (!a.id) continue;
              if (a.ref) manifestIdByEventKey.set(a.ref, a.id);
              manifestIdByEventKey.set(a.id, a.id);
            }
          }
          const selectedToInstall = pickerActions.filter((a) =>
            a.id && a.ref && selectedAppIds.has(a.id) && (a.status === 'to_install' || a.status === 'installed')).length;
          const selectedPresent = pickerActions.filter((a) =>
            a.id && a.ref && selectedAppIds.has(a.id) && a.status === 'present').length;
          const displayInstalled = pickerEnabled ? selectedToInstall : adjustedInstalled;
          const displayPresent = pickerEnabled ? selectedPresent : adjustedPresent;
          const displayTotal = pickerEnabled ? displayInstalled + displayPresent : totalApps;
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
            <Card className={`border-l-2 ${previewResult.success === false ? 'border-l-amber-500/50' : 'border-l-green-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  {previewResult.success === false ? (
                    <XCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {previewResult.success === false ? 'Preview completed with errors' : 'Preview complete'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {displayInstalled > 0
                        ? `${displayInstalled} to install, ${displayPresent} already present`
                        : pickerEnabled && pickerSelectedCount === 0
                        ? 'No apps selected'
                        : `All ${displayTotal} apps already present`}
                      {activeSettingsCount > 0 && ` · ${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'} selected`}
                      {activeSettingsCount === 0 && settingsCount > 0 && ` · ${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'} available`}
                    </p>
                  </div>
                </div>

                {previewResult.error && (
                  <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2" role="alert">
                    <p className="text-sm text-foreground">{previewResult.error.message}</p>
                    {previewResult.error.remediation && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {previewResult.error.remediation}
                      </p>
                    )}
                  </div>
                )}

                <CommandWarningList warnings={previewResult.warnings} />

                {/* Activity summary */}
                {previewResult.appEvents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {displayTotal > 0 && (
                        <FilterChip
                          onClick={clearFilters}
                          pressed={activeFilters.size === 0}
                          dimmed={activeFilters.size > 0}
                          className={`${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}
                        >
                          {displayTotal} {displayTotal === 1 ? 'app' : 'apps'}
                        </FilterChip>
                      )}
                      {displayInstalled > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('to_install')}
                          pressed={activeFilters.has('to_install')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('to_install')}
                          className={`${getColorClasses('action').bg} ${getColorClasses('action').text}`}
                        >
                          {displayInstalled} to install
                        </FilterChip>
                      )}
                      {displayPresent > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('present')}
                          pressed={activeFilters.has('present')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('present')}
                          className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                        >
                          {displayPresent} present
                        </FilterChip>
                      )}
                      {settingsCount > 0 && (
                        hasConfigMap ? (
                          <FilterChip
                            onClick={() => toggleFilter('settings')}
                            pressed={activeFilters.has('settings')}
                            dimmed={activeFilters.size > 0 && !activeFilters.has('settings')}
                            className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                          >
                            {activeSettingsCount > 0 ? `${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'}` : `${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'}`}
                          </FilterChip>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                            {activeSettingsCount > 0 ? `${activeSettingsCount} ${activeSettingsCount === 1 ? 'setting' : 'settings'}` : `${settingsCount} ${settingsCount === 1 ? 'setting' : 'settings'}`}
                          </span>
                        )
                      )}
                    </div>
                    {pickerEnabled && (
                      <div className="flex items-center justify-between mb-2" data-testid="app-picker-header">
                        <p className="text-xs text-muted-foreground" data-testid="app-picker-count">
                          {pickerSelectedCount} of {pickerIds.length} selected
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedAppIds(new Set(pickerIds))}
                            disabled={pickerSelectedCount === pickerIds.length}
                            data-testid="app-picker-select-all"
                          >
                            Select all
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedAppIds(new Set())}
                            disabled={pickerSelectedCount === 0}
                            data-testid="app-picker-select-none"
                          >
                            Select none
                          </Button>
                        </div>
                      </div>
                    )}
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
                        // Manifest app id for --only (streamed events are keyed
                        // by winget ref; the envelope actions map ref → id).
                        const appId = pickerEnabled ? manifestIdByEventKey.get(event.app) : undefined;
                        const isSelected = appId ? selectedAppIds.has(appId) : true;
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                            {pickerEnabled && (
                              <span className="w-4 flex-shrink-0 flex justify-center">
                                {appId && (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => {
                                      setSelectedAppIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(appId)) next.delete(appId);
                                        else next.add(appId);
                                        return next;
                                      });
                                    }}
                                    aria-label={`Include ${event.name || formatAppIdentity(event.app)}`}
                                    data-testid={`app-picker-checkbox-${appId}`}
                                  />
                                )}
                              </span>
                            )}
                            <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                            <span className="w-4 flex-shrink-0 flex justify-center">
                              {hasSettings && (
                                <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                              )}
                            </span>
                            <span className={`truncate ${pickerEnabled && !isSelected ? 'text-muted-foreground' : ''}`}>
                              {event.name || formatAppIdentity(event.app)}
                            </span>
                          </div>
                        );
                      })}
                      {/* Config-only apps (detected via settings, not winget) */}
                      {showConfigOnlySection && (
                        <>
                          <div className="border-t mt-2 pt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Settings only</p>
                          </div>
                          {configOnlyEvents.map((event, i) => {
                            const cfgStatusKey: StatusKey = event.statusKey || 'present';
                            const cfgUiStatus = getPhaseAwareStatusForEvent({ statusKey: cfgStatusKey, phase: 'apply', reason: event.reason });
                            const cfgColors = getColorClasses(cfgUiStatus.color);
                            return (
                              <div key={`config-${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                                <span className={`w-16 flex-shrink-0 text-right font-medium ${cfgColors.text}`}>{cfgUiStatus.shortLabel}</span>
                                <span className="w-4 flex-shrink-0 flex justify-center">
                                  <Settings2 className={`h-3 w-3 ${cfgStatusKey === 'failed' ? getColorClasses('error').text : getColorClasses('success').text}`} />
                                </span>
                                <span className="truncate">
                                  {event.name || formatAppIdentity(event.app)}
                                </span>
                              </div>
                            );
                          })}
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
                        if (intent === 'apps-only') {
                          setSelectedModules([]);
                          setRestoreTargets([]);
                        }
                      }}
                      configModuleCount={settingsCount}
                    />
                    {restoreIntent === 'apps-and-settings' && (() => {
                      const moduleRefs = previewResult.restoreModulesAvailable;
                      if (!moduleRefs?.length) return null;
                      const modules: ConfigModuleInfo[] = moduleRefs.map(ref => ({
                        id: ref.id,
                        displayName: ref.displayName || ref.id,
                        entries: 0,
                        files: [],
                      }));
                      return (
                        <ConfigModuleSelector
                          modules={modules}
                          selectedModules={selectedModules}
                          onSelectionChange={(moduleIds) => {
                            setSelectedModules(moduleIds);
                            const allowedCaptureIds = selectedCaptureIds(
                              previewResult.configResolutions,
                              moduleIds,
                            );
                            setRestoreTargets((current) => current.filter(
                              (mapping) => allowedCaptureIds.has(mapping.captureId),
                            ));
                          }}
                        />
                      );
                    })()}
                  </div>
                )}

                {(previewResult.configResolutions?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <ConfigResolutionList
                      resolutions={previewResult.configResolutions ?? []}
                      moduleDisplayNames={previewModuleDisplayNames}
                      restoreTargetSupported={restoreIntent === 'apps-and-settings' && restoreTargetSupported}
                      targetMappings={restoreTargets}
                      onTargetMappingChange={(mapping) => {
                        setRestoreTargets((current) => [
                          ...current.filter((item) => item.captureId !== mapping.captureId),
                          mapping,
                        ]);
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4">
                  {previewResult.installed > 0 && (
                    <Button
                      onClick={handleApply}
                      data-testid="setup-flow-apply"
                      disabled={previewResult.success === false || (pickerEnabled && pickerSelectedCount === 0)}
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
                <div className="mt-3">
                  <ConfigMigrationProgress events={liveConfigEvents} />
                </div>
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
            <Card className={`border-l-2 ${applyResult.success === false || applyResult.failed > 0 || applyResult.error ? 'border-l-amber-500/50' : 'border-l-green-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  {applyResult.success === false || applyResult.failed > 0 || applyResult.error ? (
                    <XCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {applyResult.success === false || applyResult.failed > 0 || applyResult.error ? 'Setup completed with errors' : 'Setup complete'}
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

                {applyResult.error && (
                  <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2" role="alert">
                    <p className="text-sm text-foreground">{applyResult.error.message}</p>
                    {applyResult.error.remediation && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {applyResult.error.remediation}
                      </p>
                    )}
                  </div>
                )}

                <CommandWarningList warnings={applyResult.warnings} />
                <ConfigResolutionList
                  resolutions={applyResult.configResolutions ?? []}
                  moduleDisplayNames={applyModuleDisplayNames}
                />

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
                  const totalApplyApps = applyResult.installed + applyResult.alreadyPresent + applyResult.failed - configOnlyCount;
                  // Partition filtered events
                  const allApplyEvents = filterEvents(applyResult.appEvents, applyConfigMap);
                  const applyWingetEvents = allApplyEvents.filter(e => !isConfigOnlyApp(e));
                  const applyConfigOnlyEvents = allApplyEvents.filter(e => isConfigOnlyApp(e));
                  const showApplyConfigOnlySection = applyConfigOnlyEvents.length > 0 && (activeFilters.size === 0 || activeFilters.has('settings'));
                  return (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {totalApplyApps > 0 && (
                        <FilterChip
                          onClick={clearFilters}
                          pressed={activeFilters.size === 0}
                          dimmed={activeFilters.size > 0}
                          className={`${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}
                        >
                          {totalApplyApps} {totalApplyApps === 1 ? 'app' : 'apps'}
                        </FilterChip>
                      )}
                      {applyResult.installed > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('installed')}
                          pressed={activeFilters.has('installed')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('installed')}
                          className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                        >
                          {applyResult.installed} installed
                        </FilterChip>
                      )}
                      {applyResult.alreadyPresent > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('present')}
                          pressed={activeFilters.has('present')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('present')}
                          className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                        >
                          {applyResult.alreadyPresent} present
                        </FilterChip>
                      )}
                      {applyResult.skipped > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('skipped')}
                          pressed={activeFilters.has('skipped')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('skipped')}
                          className={`${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                        >
                          {applyResult.skipped} skipped
                        </FilterChip>
                      )}
                      {applyResult.failed > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('failed')}
                          pressed={activeFilters.has('failed')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('failed')}
                          className={`${getColorClasses('error').bg} ${getColorClasses('error').text}`}
                        >
                          {applyResult.failed} failed
                        </FilterChip>
                      )}
                      {applySettingsTotal > 0 && (
                        applySettingsProcessed > 0 ? (
                          <FilterChip
                            onClick={() => toggleFilter('settings')}
                            pressed={activeFilters.has('settings')}
                            dimmed={activeFilters.size > 0 && !activeFilters.has('settings')}
                            className={applySettingsFailed > 0 ? `${getColorClasses('warn').bg} ${getColorClasses('warn').text}` : `${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                          >
                            {applySettingsRestored > 0 && applySettingsFailed === 0
                              ? `${applySettingsRestored} ${applySettingsRestored === 1 ? 'setting' : 'settings'} restored`
                              : applySettingsFailed > 0
                              ? `${applySettingsProcessed} ${applySettingsProcessed === 1 ? 'setting' : 'settings'} (${applySettingsFailed} failed)`
                              : `${applySettingsProcessed} ${applySettingsProcessed === 1 ? 'setting' : 'settings'}`
                            }
                          </FilterChip>
                        ) : (
                          <FilterChip
                            onClick={() => toggleFilter('settings')}
                            pressed={activeFilters.has('settings')}
                            dimmed={activeFilters.size > 0 && !activeFilters.has('settings')}
                            className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                          >
                            {applySettingsTotal} {applySettingsTotal === 1 ? 'setting' : 'settings'}
                          </FilterChip>
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
                      {/* Config-only apps (detected via settings, not winget) */}
                      {showApplyConfigOnlySection && (
                        <>
                          <div className="border-t mt-2 pt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Settings only</p>
                          </div>
                          {applyConfigOnlyEvents.map((event, i) => {
                            // Check if this config-only module was selected for restore
                            const moduleId = fullConfigMap[event.app];
                            const shortId = moduleId?.includes('.') ? moduleId.split('.').pop()! : moduleId;
                            const wasSelected = restoreIntent === 'apps-and-settings' &&
                              selectedModules.length > 0 &&
                              (selectedModules.includes(shortId ?? '') || selectedModules.includes(moduleId ?? ''));
                            // If not selected, show as skipped regardless of engine status
                            const cfgStatusKey: StatusKey = wasSelected ? (event.statusKey || 'present') : 'skipped';
                            const cfgLabel = wasSelected
                              ? getPhaseAwareStatusForEvent({ statusKey: cfgStatusKey, phase: 'apply', reason: event.reason }).shortLabel
                              : 'SKIPPED';
                            const cfgColor = wasSelected
                              ? getColorClasses(getPhaseAwareStatusForEvent({ statusKey: cfgStatusKey, phase: 'apply', reason: event.reason }).color)
                              : getColorClasses('warn');
                            return (
                              <div key={`config-${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                                <span className={`w-16 flex-shrink-0 text-right font-medium ${cfgColor.text}`}>{cfgLabel}</span>
                                <span className="w-4 flex-shrink-0 flex justify-center">
                                  <Settings2 className={`h-3 w-3 ${cfgStatusKey === 'failed' ? getColorClasses('error').text : wasSelected ? getColorClasses('success').text : getColorClasses('warn').text}`} />
                                </span>
                                <span className={`truncate ${!wasSelected ? 'text-muted-foreground' : ''}`}>
                                  {event.name || formatAppIdentity(event.app)}
                                </span>
                              </div>
                            );
                          })}
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
                    {errorRemediation !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {errorRemediation}
                      </p>
                    )}
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

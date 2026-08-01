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
import { DropZone, NativeProfileDropFeedback } from './drop-zone';
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
  ProfileInspectionData,
} from '@/types';
import type { EngineExecResult } from '@/lib/engine-exec';
import type { ConfigProgressEvent } from '@/lib/streaming-events';
import { RestoreIntentToggle } from '@/components/app/overview/components/restore-intent-toggle';
import { ConfigModuleSelector } from '@/components/app/overview/components/config-module-selector';
import { ConfigResolutionList } from './config-resolution-list';
import { ConfigMigrationProgress } from './config-migration-progress';
import { ProfileContentsModal } from './profile-contents-modal';
import { EngineEnvelopeError } from '@/lib/engine-envelope-error';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
  getActivityRowLabel,
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

function appIdSet(appIds: string[] | undefined): Set<string> {
  return new Set(appIds ?? []);
}

function isConfigOnlyApp(event: AppEvent, synthesizedAppIds: Set<string>): boolean {
  return synthesizedAppIds.has(event.app);
}

interface ApplyAppCounts {
  total: number;
  installed: number;
  present: number;
  skipped: number;
  failed: number;
}

function countApplyActions(
  actions: EndstateApplyData['actions'],
  synthesizedAppIds: Set<string>,
  dryRun: boolean,
): ApplyAppCounts | null {
  if (!actions?.length) return null;

  const authoredActions = actions.filter((action) =>
    !isConfigOnlyAction(action, synthesizedAppIds),
  );
  const installed = authoredActions.filter((action) =>
    action.status === 'installed' || (dryRun && action.status === 'to_install'),
  ).length;
  const present = authoredActions.filter((action) => action.status === 'present').length;
  const failed = authoredActions.filter((action) => action.status === 'failed').length;
  const skipped = authoredActions.length - installed - present - failed;

  return { total: authoredActions.length, installed, present, skipped, failed };
}

/** Count synthesized terminal rows so legacy callers can adjust action totals per status. */
function countSynthesizedApplyEvents(
  events: AppEvent[],
  synthesizedAppIds: Set<string>,
  dryRun: boolean,
): ApplyAppCounts {
  const synthesizedRows = events.filter((event) =>
    (!event.kind || event.kind === 'app')
    && event.app !== '── APPLY ──'
    && event.app !== '── VERIFY ──'
    && !event.app.startsWith('copy:')
    && isConfigOnlyApp(event, synthesizedAppIds),
  );
  const installed = synthesizedRows.filter((event) =>
    event.statusKey === 'installed' || (dryRun && event.statusKey === 'to_install'),
  ).length;
  const present = synthesizedRows.filter((event) => event.statusKey === 'present').length;
  const failed = synthesizedRows.filter((event) => event.statusKey === 'failed').length;
  const skipped = synthesizedRows.length - installed - present - failed;

  return { total: synthesizedRows.length, installed, present, skipped, failed };
}

function normalizeConfigModuleId(moduleId: string): string {
  return moduleId.startsWith('apps.') ? moduleId.slice('apps.'.length) : moduleId;
}

/**
 * The engine's config map is catalog metadata. Only restore modules explicitly
 * advertised for this profile are evidence that the profile carries settings.
 */
function profileConfigModuleMap(
  configMap: Record<string, string> | undefined,
  restoreModules: RestoreModuleRef[] | undefined,
): Record<string, string> {
  const availableModuleIds = new Set(
    (restoreModules ?? []).map((moduleRef) => normalizeConfigModuleId(moduleRef.id)),
  );
  if (availableModuleIds.size === 0) return {};

  return Object.fromEntries(
    Object.entries(configMap ?? {}).filter(([, moduleId]) =>
      availableModuleIds.has(normalizeConfigModuleId(moduleId))),
  );
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
  /** Ref-less manual rows appended by the engine, not authored profile apps. */
  synthesizedAppIds?: string[];
  restoreModulesAvailable?: RestoreModuleRef[];
  /** Maps winget ID → config module name for apps with settings */
  configModuleMap?: Record<string, string>;
  configResolutions?: ConfigResolution[];
  configResolutionSummary?: ConfigResolutionSummary;
  warnings?: CommandWarning[];
}

export interface SetupPreviewOptions {
  restoreIntent: RestoreIntent;
}

function isConfigOnlyAction(
  action: NonNullable<EndstateApplyData['actions']>[number],
  synthesizedAppIds: Set<string>,
): boolean {
  return !!action.id && synthesizedAppIds.has(action.id);
}

/**
 * Every manifest app with an id is selectable except a synthesized settings
 * row. In particular, a user-authored manual app is still an app even though
 * it has no package-manager ref.
 */
function selectablePickerIds(
  actions: EndstateApplyData['actions'],
  synthesizedAppIds: Set<string>,
): string[] {
  return (actions ?? [])
    .filter((action) => action.id && !isConfigOnlyAction(action, synthesizedAppIds))
    .map((action) => action.id!);
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
 * the selected app ids plus all synthesized config-only ids. Config-only ids
 * are always included so the "Settings only" section and restore-intent
 * composition behave exactly as an unfiltered run; ordinary manual apps honor
 * the user's picker selection.
 *
 * Note: deselecting a winget app also removes its matched config modules from
 * the engine's restore scope (subset apply = subset restore), even if that
 * module is still checked in the module selector — the engine matches modules
 * against the filtered app set.
 */
function buildOnlyAppIds(
  actions: EndstateApplyData['actions'],
  selected: Set<string>,
  synthesizedAppIds: Set<string>,
): string[] {
  const out: string[] = [];
  for (const a of actions ?? []) {
    if (!a.id) continue;
    if (isConfigOnlyAction(a, synthesizedAppIds) || selected.has(a.id)) {
      out.push(a.id);
    }
  }
  return out;
}

interface ApplyResult {
  success?: boolean;
  /**
   * True when the run was a preview that changed nothing. The results surface
   * must not report installs or completed setup for such a run — see
   * gui-integration-contract.md, "Dry-Run Disclosure".
   */
  dryRun?: boolean;
  installed: number;
  alreadyPresent: number;
  failed: number;
  skipped: number;
  appEvents: AppEvent[];
  /** Authoritative terminal app actions when available. */
  actions?: EndstateApplyData['actions'];
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
  /** Exact newly imported profile shown in browse until Review setup is explicit. */
  recentlyImportedProfile?: DiscoveredProfile | null;
  /** Clears the one-shot imported treatment after review or lifecycle reset. */
  onRecentlyImportedConsumed?: () => void;
  onBack: () => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onFileDrop: (files: File[]) => void;
  /** Import is staging/validating and must remain on the visible profile list. */
  profileImportActive?: boolean;
  /** Native Tauri drag acceptance owned by App. */
  nativeDragAccepted?: boolean;
  /** Native file browse (Tauri mode only) */
  onBrowse?: () => void;
  onDeleteProfile: (path: string, displayName: string) => void;
  // Apply flow props
  isRunning: boolean;
  setupProgress: { message: string; detail?: string } | null;
  liveAppEvents: AppEvent[];
  liveConfigEvents?: ConfigProgressEvent[];
  onPreview: (profile: DiscoveredProfile, options: SetupPreviewOptions) => Promise<PreviewResult>;
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
  /** Current-engine support for the read-only `profile inspect` boundary. */
  profileInspectionSupported?: boolean;
  /** Inspects a saved manifest without selecting or previewing it. */
  onInspectProfile?: (manifestPath: string) => Promise<ProfileInspectionData>;
}

export function SetupFlow({
  profiles,
  recentlyImportedProfile,
  onRecentlyImportedConsumed,
  onBack,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onFileDrop,
  profileImportActive = false,
  nativeDragAccepted = false,
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
  profileInspectionSupported = false,
  onInspectProfile,
}: SetupFlowProps) {
  const [refreshing, setRefreshing] = useState(false);
  // Profile whose "What's inside" summary is open. Inspection is read-only and
  // independent of selection — looking inside a bundle must not start a run.
  const [inspectedProfile, setInspectedProfile] = useState<DiscoveredProfile | null>(null);
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
  const previewGenerationRef = useRef(0);
  const activePreviewRef = useRef<{
    profilePath: string;
    restoreIntent: RestoreIntent;
    generation: number;
  } | null>(null);
  const selectedAppIdsProfileRef = useRef<string | null>(null);
  const recentlyImportedCardRef = useRef<HTMLDivElement | null>(null);
  const previewModuleDisplayNames = moduleDisplayNameMap(
    previewResult?.restoreModulesAvailable,
  );
  const applyModuleDisplayNames = moduleDisplayNameMap(
    applyResult?.restoreModulesAvailable?.length
      ? applyResult.restoreModulesAvailable
      : previewResult?.restoreModulesAvailable,
  );
  const previewProfileConfigMap = profileConfigModuleMap(
    previewResult?.configModuleMap,
    previewResult?.restoreModulesAvailable,
  );
  const applyRestoreModules = applyResult?.restoreModulesAvailable?.length
    ? applyResult.restoreModulesAvailable
    : previewResult?.restoreModulesAvailable;
  const applyProfileConfigMap = profileConfigModuleMap(
    applyResult?.configModuleMap ?? previewResult?.configModuleMap,
    applyRestoreModules,
  );
  const previewSynthesizedAppIds = appIdSet(previewResult?.synthesizedAppIds);
  // Apply runs the same profile plan as its preview. Keep using preview
  // provenance because the apply result only streams item rows, not actions.
  const applySynthesizedAppIds = previewSynthesizedAppIds;
  const applyActionCounts = applyResult
    ? countApplyActions(
        applyResult.actions,
        applySynthesizedAppIds,
        applyResult.dryRun ?? false,
      )
    : null;
  const synthesizedApplyCounts = applyResult
    ? countSynthesizedApplyEvents(
        applyResult.appEvents,
        applySynthesizedAppIds,
        applyResult.dryRun ?? false,
      )
    : { total: 0, installed: 0, present: 0, skipped: 0, failed: 0 };
  const fallbackInstalled = Math.max(0, (applyResult?.installed ?? 0) - synthesizedApplyCounts.installed);
  const fallbackPresent = Math.max(0, (applyResult?.alreadyPresent ?? 0) - synthesizedApplyCounts.present);
  const fallbackSkipped = Math.max(0, (applyResult?.skipped ?? 0) - synthesizedApplyCounts.skipped);
  const fallbackFailed = Math.max(0, (applyResult?.failed ?? 0) - synthesizedApplyCounts.failed);
  const applyDisplayAppCounts: ApplyAppCounts = applyActionCounts ?? {
    total: fallbackInstalled + fallbackPresent + fallbackSkipped + fallbackFailed,
    installed: fallbackInstalled,
    present: fallbackPresent,
    skipped: fallbackSkipped,
    failed: fallbackFailed,
  };
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };
  const interactionBlocked = isRunning || profileImportActive;

  // Reset internal state when resetKey changes (parent signals a fresh start)
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      previewGenerationRef.current += 1;
      activePreviewRef.current = null;
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
      selectedAppIdsProfileRef.current = null;
      setUndoDryRunData(null);
      setUndoExecuteData(null);
      setUndoError('');
    }
  }, [resetKey]);

  useEffect(() => {
    if (!recentlyImportedProfile || phase !== 'browse') return;
    const card = recentlyImportedCardRef.current;
    card?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [phase, recentlyImportedProfile, reduced]);

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
  /**
   * Phase separator headers and raw config copy operations are internal engine
   * detail, never shown. Shared with the chip counts so a chip can never
   * advertise a number the list below it will not render.
   */
  const isDisplayableEvent = (e: AppEvent) =>
    e.app !== '── APPLY ──' && e.app !== '── VERIFY ──' && !e.app.startsWith('copy:');

  /** Winget apps carrying no settings — the complement of the `settings` filter. */
  const appsOnlyCount = (
    events: AppEvent[],
    configMap: Record<string, string>,
    synthesizedAppIds: Set<string>,
  ) =>
    events.filter(
      (e) =>
        isDisplayableEvent(e)
        && !isConfigOnlyApp(e, synthesizedAppIds)
        && !(e.app in configMap),
    ).length;

  const filterEvents = (
    events: AppEvent[],
    configMap: Record<string, string>,
    synthesizedAppIds: Set<string>,
  ) => {
    const filtered = events.filter(isDisplayableEvent);
    if (activeFilters.size === 0) return filtered;
    return filtered.filter(event => {
      const statusKey: StatusKey = event.statusKey || 'skipped';
      for (const f of activeFilters) {
        if (f === 'settings' && (event.app in configMap || isConfigOnlyApp(event, synthesizedAppIds))) return true;
        // Complement of `settings`. The filter set had a positive "has settings"
        // filter but no way to ask the opposite question — "which of these are
        // just app installs?" — which is the more common one when reviewing a
        // plan.
        if (f === 'apps_only' && !(event.app in configMap || isConfigOnlyApp(event, synthesizedAppIds))) return true;
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

  const previewIsActive = (
    profile: DiscoveredProfile,
    intent: RestoreIntent,
    generation: number,
  ) => {
    const active = activePreviewRef.current;
    return active?.profilePath === profile.path
      && active.restoreIntent === intent
      && active.generation === generation;
  };

  const handleSelectProfile = (profile: DiscoveredProfile) => {
    setSelectedProfile(profile);
    setRestoreIntent('apps-only');
    setSelectedModules([]);
    setRestoreTargets([]);
    selectedAppIdsProfileRef.current = null;
    setSelectedAppIds(new Set());
    void handlePreview(profile, 'apps-only');
  };

  const handlePreview = async (profile: DiscoveredProfile, intent: RestoreIntent) => {
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    activePreviewRef.current = {
      profilePath: profile.path,
      restoreIntent: intent,
      generation,
    };
    setPhase('previewing');
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    setErrorRemediation(null);
    setActiveFilters(new Set());
    setSelectedModules([]);
    setRestoreTargets([]);
    try {
      const result = await onPreview(profile, { restoreIntent: intent });
      if (!previewIsActive(profile, intent, generation)) return;
      setPreviewResult(result);
      const pickerIds = selectablePickerIds(
        result.actions,
        appIdSet(result.synthesizedAppIds),
      );
      const isSameProfile = selectedAppIdsProfileRef.current === profile.path;
      setSelectedAppIds((current) => {
        if (!isSameProfile) {
          return new Set(pickerIds);
        }
        return new Set(pickerIds.filter((id) => current.has(id)));
      });
      selectedAppIdsProfileRef.current = profile.path;
      setPhase('preview-done');
    } catch (err) {
      if (!previewIsActive(profile, intent, generation)) return;
      const previewError = err instanceof Error ? err : new Error('Preview failed');
      setErrorMessage(previewError.message);
      setErrorRemediation(err instanceof EngineEnvelopeError ? err.remediation ?? null : null);
      setPhase('error');
    }
  };

  const handleReviewImportedProfile = (profile: DiscoveredProfile) => {
    onRecentlyImportedConsumed?.();
    handleSelectProfile(profile);
  };

  const handleApply = async () => {
    if (!selectedProfile) return;
    const settingsCount = previewResult?.restoreModulesAvailable?.length ?? 0;
    // Per-app subset: only when the engine advertises --only AND the user
    // deselected at least one app. All-selected omits the field entirely so
    // the apply invocation is byte-identical to a picker-less run.
    const pickerIds = selectablePickerIds(previewResult?.actions, previewSynthesizedAppIds);
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
          // Thread engine display-name context so live restore rows read
          // "Notepad++ · contextMenu.xml" during streaming, not just after the
          // terminal envelope lands.
          ...(previewResult?.restoreModulesAvailable ? { restoreModulesAvailable: previewResult.restoreModulesAvailable } : {}),
          ...(Object.keys(previewProfileConfigMap).length > 0 ? { configModuleMap: previewProfileConfigMap } : {}),
        }
      : undefined;
    const options = subsetActive
      ? { ...(restoreOpts ?? {}), onlyAppIds: buildOnlyAppIds(previewResult?.actions, selectedAppIds, previewSynthesizedAppIds) }
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
    previewGenerationRef.current += 1;
    activePreviewRef.current = null;
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
    selectedAppIdsProfileRef.current = null;
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
        disabled={profileImportActive || phase === 'previewing' || phase === 'applying' || phase === 'undo-checking' || phase === 'undo-running'}
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

      <NativeProfileDropFeedback visible={nativeDragAccepted && phase !== 'browse'} />

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
                  onClick={() => !interactionBlocked && onRestoreFromCloud()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !interactionBlocked) {
                      e.preventDefault();
                      onRestoreFromCloud();
                    }
                  }}
                  tabIndex={interactionBlocked ? -1 : 0}
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
              {profileImportActive && (
                <div
                  className="mb-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3"
                  role="status"
                  data-testid="profile-import-progress"
                >
                  <p className="text-sm font-medium text-green-500">Importing profile…</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Validating and adding it to your setup list.
                  </p>
                </div>
              )}
              <DropZone
                onFileDrop={onFileDrop}
                onBrowse={onBrowse}
                disabled={interactionBlocked}
                nativeDragAccepted={nativeDragAccepted}
              />
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
                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing || interactionBlocked}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {onUndoDryRun && (
                    <Button variant="ghost" size="sm" onClick={handleStartUndo} disabled={interactionBlocked}>
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
                    const isRecentlyImported = recentlyImportedProfile?.path === profile.path;
                    const showSecondaryName =
                      !!profile.displayName && profile.displayName !== profile.name;
                    return (
                    <Card
                      key={profile.name}
                      ref={isRecentlyImported ? recentlyImportedCardRef : undefined}
                      className={`${isRecentlyImported ? 'border-green-500/50 shadow-sm' : 'cursor-pointer hover:border-green-500/50 hover:shadow-md'} transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-500/50`}
                      onClick={() => {
                        if (!isRecentlyImported && !interactionBlocked) handleSelectProfile(profile);
                      }}
                      onKeyDown={(e) => {
                        if (!isRecentlyImported && !interactionBlocked && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSelectProfile(profile);
                        }
                      }}
                      tabIndex={isRecentlyImported || interactionBlocked ? undefined : 0}
                      role={isRecentlyImported ? undefined : 'button'}
                      aria-disabled={interactionBlocked || undefined}
                      data-testid={`profile-card-${profile.name}`}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="text-sm font-medium truncate leading-5">
                                {profile.displayName || profile.name}
                              </p>
                              {isRecentlyImported && (
                                <span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
                                  Imported
                                </span>
                              )}
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
                            <div className="mt-1 flex flex-wrap items-center gap-x-3">
                              {/* Inspection sits with the card's other inline
                                  links rather than the action cluster, so the
                                  Delete/Select pair stays a two-button decision. */}
                              <Button
                                type="button"
                                variant="link"
                                size="inline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedProfile(profile);
                                }}
                                aria-label={`What's inside ${profile.displayName || profile.name}`}
                                className="gap-1 text-xs"
                                data-testid={`profile-card-${profile.name}-whats-inside`}
                              >
                                <Info className="h-3 w-3" aria-hidden="true" />
                                What&apos;s inside
                              </Button>
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
                                    disabled={interactionBlocked}
                                    className="gap-1 text-xs"
                                    data-testid={`profile-card-${profile.name}-push-to-cloud`}
                                  >
                                    <Cloud className="h-3 w-3" aria-hidden="true" />
                                    Back up to cloud
                                  </Button>
                                )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              tabIndex={isRecentlyImported ? 0 : -1}
                              aria-label={`Delete ${profile.displayName || profile.name}`}
                              disabled={interactionBlocked}
                              className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProfile(profile.path, profile.displayName || profile.name);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {isRecentlyImported ? (
                              <Button
                                size="sm"
                                disabled={interactionBlocked}
                                className="bg-green-600 text-white hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReviewImportedProfile(profile);
                                }}
                              >
                                Review setup
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                tabIndex={-1}
                                disabled={interactionBlocked}
                              >
                                Select
                              </Button>
                            )}
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
                    <p className="text-sm font-medium">
                      {restoreIntent === 'apps-and-settings'
                        ? 'Checking settings compatibility...'
                        : 'Previewing changes...'}
                    </p>
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
                {selectedProfile && selectedAppIdsProfileRef.current === selectedProfile.path && (
                  <Button
                    data-testid="setup-flow-apply"
                    disabled
                    className="mt-4 bg-green-600 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Apply changes
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Preview done: Show results + Apply button */}
        {phase === 'preview-done' && previewResult && (() => {
          const configMap = previewProfileConfigMap;
          const hasConfigMap = Object.keys(configMap).length > 0;
          const settingsCount = previewResult.restoreModulesAvailable?.length ?? 0;
          // Active settings count reflects user's restore selection
          const activeSettingsCount = restoreIntent === 'apps-and-settings' ? selectedModules.length : 0;
          // Separate config-only synthesized apps from winget apps
          const configOnlyPresent = previewResult.appEvents.filter(e => isConfigOnlyApp(e, previewSynthesizedAppIds) && (e.statusKey === 'present' || !e.statusKey)).length;
          const configOnlyToInstall = previewResult.appEvents.filter(e => isConfigOnlyApp(e, previewSynthesizedAppIds) && e.statusKey === 'to_install').length;
          const adjustedInstalled = previewResult.installed - configOnlyToInstall;
          const adjustedPresent = previewResult.alreadyPresent - configOnlyPresent;
          const totalApps = adjustedInstalled + adjustedPresent;
          // Per-app picker (capability-gated). Selection re-slices the
          // engine-reported plan counts client-side — presentation only, no
          // planning logic. Dark (pickerEnabled false) → display counts are
          // exactly the adjusted envelope counts, byte-identical to before.
          const pickerActions = previewResult.actions ?? [];
          const pickerIds = selectablePickerIds(pickerActions, previewSynthesizedAppIds);
          const pickerIdSet = new Set(pickerIds);
          const pickerEnabled = applyOnlySupported && pickerIds.length > 0;
          const pickerSelectedCount = pickerIds.filter((id) => selectedAppIds.has(id)).length;
          const manifestIdByEventKey = new Map<string, string>();
          if (pickerEnabled) {
            for (const a of pickerActions) {
              if (!a.id || !pickerIdSet.has(a.id)) continue;
              if (a.ref) manifestIdByEventKey.set(a.ref, a.id);
              manifestIdByEventKey.set(a.id, a.id);
            }
          }
          const selectedToInstall = pickerActions.filter((a) =>
            a.id && pickerIdSet.has(a.id) && selectedAppIds.has(a.id) && (a.status === 'to_install' || a.status === 'installed')).length;
          const selectedPresent = pickerActions.filter((a) =>
            a.id && pickerIdSet.has(a.id) && selectedAppIds.has(a.id) && a.status === 'present').length;
          const displayInstalled = pickerEnabled ? selectedToInstall : adjustedInstalled;
          const displayPresent = pickerEnabled ? selectedPresent : adjustedPresent;
          const displayTotal = pickerEnabled ? displayInstalled + displayPresent : totalApps;
          // Partition filtered events
          const previewAppsOnlyCount = appsOnlyCount(
            previewResult.appEvents,
            configMap,
            previewSynthesizedAppIds,
          );
          const allFilteredEvents = filterEvents(previewResult.appEvents, configMap, previewSynthesizedAppIds);
          const wingetEvents = allFilteredEvents.filter(e => !isConfigOnlyApp(e, previewSynthesizedAppIds));
          const configOnlyEvents = allFilteredEvents.filter(e => isConfigOnlyApp(e, previewSynthesizedAppIds));
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
                      {previewAppsOnlyCount > 0 && settingsCount > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('apps_only')}
                          pressed={activeFilters.has('apps_only')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('apps_only')}
                          className={`${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}
                        >
                          {previewAppsOnlyCount} without settings
                        </FilterChip>
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
                            <p className="text-[10px] font-medium text-muted-foreground">
                              Settings only — app installation not included
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1">
                              Endstate can restore these settings, but this profile cannot install the accompanying app.
                            </p>
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
                    {restoreIntent === 'apps-only' && (
                      <div
                        className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
                        data-testid="settings-restore-off-summary"
                      >
                        {settingsCount} {settingsCount === 1 ? 'setting is' : 'settings are'} available but won&apos;t be restored
                      </div>
                    )}
                    <RestoreIntentToggle
                      restoreIntent={restoreIntent}
                      onRestoreIntentChange={(intent) => {
                        if (intent === restoreIntent || !selectedProfile) return;
                        setRestoreIntent(intent);
                        setSelectedModules([]);
                        setRestoreTargets([]);
                        void handlePreview(selectedProfile, intent);
                      }}
                      configModuleCount={settingsCount}
                    />
                    {restoreIntent === 'apps-and-settings' && (() => {
                      const moduleRefs = previewResult.restoreModulesAvailable;
                      if (!moduleRefs?.length) return null;
                      const modules: ConfigModuleInfo[] = moduleRefs.map(ref => ({
                        id: ref.id,
                        displayName: ref.displayName,
                        // How many restore entries the profile carries for this
                        // module. Was hardcoded to 0, which made the per-module
                        // count in ConfigModuleSelector dead code — and hid that
                        // most offered modules carried nothing at all.
                        // Older engines omit it; 0 keeps the hint hidden rather
                        // than asserting a count we do not have.
                        entries: ref.entryCount ?? 0,
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
                    {/* Choosing "apps and settings" but checking nothing sends
                        no --enable-restore at all, so the run silently becomes
                        apps-only. Say so rather than letting the label imply
                        settings will transfer. */}
                    {restoreIntent === 'apps-and-settings'
                      && (previewResult.restoreModulesAvailable?.length ?? 0) > 0
                      && selectedModules.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500" data-testid="no-settings-selected-notice">
                        No settings selected — this will set up apps only.
                      </p>
                    )}
                    {(() => {
                      return null;
                    })()}
                  </div>
                )}

                {restoreIntent === 'apps-and-settings' && (previewResult.configResolutions?.length ?? 0) > 0 && (
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
                  {previewResult.success === false
                    && selectedProfile
                    && restoreIntent === 'apps-and-settings' && (
                      <Button onClick={() => void handlePreview(selectedProfile, 'apps-and-settings')}>
                        Retry settings preview
                      </Button>
                    )}
                  {(previewResult.installed > 0 || activeSettingsCount > 0) && (
                    <Button
                      onClick={handleApply}
                      data-testid="setup-flow-apply"
                      disabled={
                        previewResult.success === false
                        || (pickerEnabled && pickerSelectedCount === 0)
                      }
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
                    <p className="text-sm font-medium">Applying setup...</p>
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
                      // Restore rows read RESTORING/RESTORED (never "INSTALLING")
                      // and carry the engine display name; app rows stay phase-aware.
                      const { shortLabel, color } = getActivityRowLabel(event, 'apply');
                      const colors = getColorClasses(color);
                      return (
                        <div
                          key={`${event.app}-${event.timestamp}-${i}`}
                          className="flex items-center gap-2 text-xs pt-0.5"
                          title={event.title}
                        >
                          <span className={`w-16 text-right font-medium ${colors.text}`}>
                            {shortLabel}
                          </span>
                          <span className="truncate flex-1">
                            {event.name || formatAppIdentity(event.app)}
                            {event.secondary && (
                              <span className="text-muted-foreground"> · {event.secondary}</span>
                            )}
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
            <Card className={`border-l-2 ${applyResult.success === false || applyDisplayAppCounts.failed > 0 || applyResult.error ? 'border-l-amber-500/50' : 'border-l-green-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  {applyResult.success === false || applyDisplayAppCounts.failed > 0 || applyResult.error ? (
                    <XCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {applyResult.success === false || applyDisplayAppCounts.failed > 0 || applyResult.error
                        ? 'Setup completed with errors'
                        : applyResult.dryRun
                          ? 'Preview complete — nothing was installed'
                          : 'Setup complete'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {applyResult.dryRun
                        ? `${applyDisplayAppCounts.installed} would be installed, ${applyDisplayAppCounts.present} already present`
                        : `${applyDisplayAppCounts.installed} installed, ${applyDisplayAppCounts.present} already present`}
                      {applyDisplayAppCounts.failed > 0 ? `, ${applyDisplayAppCounts.failed} failed` : ''}
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
                {restoreIntent === 'apps-and-settings' && (applyResult.configResolutions?.length ?? 0) > 0 && (
                  <ConfigResolutionList
                    resolutions={applyResult.configResolutions ?? []}
                    moduleDisplayNames={applyModuleDisplayNames}
                  />
                )}

                {/* Activity summary */}
                {applyResult.appEvents.length > 0 && (() => {
                  const fullConfigMap = applyProfileConfigMap;
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
                  // Partition filtered events
                  const applyAppsOnlyCount = appsOnlyCount(
                    applyResult.appEvents,
                    applyConfigMap,
                    applySynthesizedAppIds,
                  );
                  const allApplyEvents = filterEvents(applyResult.appEvents, applyConfigMap, applySynthesizedAppIds);
                  const applyWingetEvents = allApplyEvents.filter(e => !isConfigOnlyApp(e, applySynthesizedAppIds));
                  const applyConfigOnlyEvents = allApplyEvents.filter(e => isConfigOnlyApp(e, applySynthesizedAppIds));
                  const showApplyConfigOnlySection = applyConfigOnlyEvents.length > 0 && (activeFilters.size === 0 || activeFilters.has('settings'));
                  return (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {applyDisplayAppCounts.total > 0 && (
                        <FilterChip
                          onClick={clearFilters}
                          pressed={activeFilters.size === 0}
                          dimmed={activeFilters.size > 0}
                          className={`${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}
                        >
                          {applyDisplayAppCounts.total} {applyDisplayAppCounts.total === 1 ? 'app' : 'apps'}
                        </FilterChip>
                      )}
                      {applyDisplayAppCounts.installed > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('installed')}
                          pressed={activeFilters.has('installed')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('installed')}
                          className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                        >
                          {applyDisplayAppCounts.installed} installed
                        </FilterChip>
                      )}
                      {applyDisplayAppCounts.present > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('present')}
                          pressed={activeFilters.has('present')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('present')}
                          className={`${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                        >
                          {applyDisplayAppCounts.present} present
                        </FilterChip>
                      )}
                      {applyDisplayAppCounts.skipped > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('skipped')}
                          pressed={activeFilters.has('skipped')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('skipped')}
                          className={`${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                        >
                          {applyDisplayAppCounts.skipped} skipped
                        </FilterChip>
                      )}
                      {applyDisplayAppCounts.failed > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('failed')}
                          pressed={activeFilters.has('failed')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('failed')}
                          className={`${getColorClasses('error').bg} ${getColorClasses('error').text}`}
                        >
                          {applyDisplayAppCounts.failed} failed
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
                      {applyAppsOnlyCount > 0 && applySettingsTotal > 0 && (
                        <FilterChip
                          onClick={() => toggleFilter('apps_only')}
                          pressed={activeFilters.has('apps_only')}
                          dimmed={activeFilters.size > 0 && !activeFilters.has('apps_only')}
                          className={`${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}
                        >
                          {applyAppsOnlyCount} without settings
                        </FilterChip>
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {applyWingetEvents.map((event, i) => {
                        // Restore rows read RESTORING/RESTORED and carry the
                        // engine display name; app rows stay phase-aware ("apply").
                        const { shortLabel, color } = getActivityRowLabel(event, 'apply');
                        const colors = getColorClasses(color);
                        const hasSettings = (restoreIntent === 'apps-and-settings' && event.app in applyConfigMap) || event.kind === 'restore' || event.app.startsWith('\u2699');
                        const settingsOk = color !== 'error';
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5" title={event.title}>
                            <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>{shortLabel}</span>
                            <span className="w-4 flex-shrink-0 flex justify-center">
                              {hasSettings && (
                                <Settings2 className={`h-3 w-3 ${settingsOk ? getColorClasses('success').text : getColorClasses('error').text} ${!settingsOk ? 'opacity-50' : ''}`} />
                              )}
                            </span>
                            <span className="truncate">
                              {event.name || formatAppIdentity(event.app)}
                              {event.secondary && (
                                <span className="text-muted-foreground"> \u00b7 {event.secondary}</span>
                              )}
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
                            // Settings the user chose not to restore are not a
                            // problem, so they must not borrow the warning
                            // vocabulary. An orange SKIPPED beside every setting
                            // reads as a run that half-failed when the user
                            // simply picked "Install apps only". A genuine
                            // engine skip — selected, then skipped — keeps its
                            // warning styling below.
                            const cfgStatusKey: StatusKey = wasSelected ? (event.statusKey || 'present') : 'skipped';
                            const cfgLabel = wasSelected
                              ? getPhaseAwareStatusForEvent({ statusKey: cfgStatusKey, phase: 'apply', reason: event.reason }).shortLabel
                              : 'EXCLUDED';
                            const cfgColor = wasSelected
                              ? getColorClasses(getPhaseAwareStatusForEvent({ statusKey: cfgStatusKey, phase: 'apply', reason: event.reason }).color)
                              : { text: 'text-muted-foreground' };
                            return (
                              <div key={`config-${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                                <span className={`w-16 flex-shrink-0 text-right font-medium ${cfgColor.text}`}>{cfgLabel}</span>
                                <span className="w-4 flex-shrink-0 flex justify-center">
                                  <Settings2 className={`h-3 w-3 ${cfgStatusKey === 'failed' ? getColorClasses('error').text : wasSelected ? getColorClasses('success').text : 'text-muted-foreground'}`} />
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
                  {onUndoDryRun && restoreIntent === 'apps-and-settings' && ((applyResult.configsRestored ?? 0) > 0 || Object.keys(applyProfileConfigMap).length > 0) && (
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
                <div className="mt-2 flex items-center gap-2">
                  {selectedProfile && restoreIntent === 'apps-and-settings' && (
                    <>
                      {previewResult === null && (
                        <Button onClick={() => void handlePreview(selectedProfile, 'apps-and-settings')}>
                          Retry settings preview
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRestoreIntent('apps-only');
                          setSelectedModules([]);
                          setRestoreTargets([]);
                          void handlePreview(selectedProfile, 'apps-only');
                        }}
                      >
                        Continue with apps only
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" onClick={handleBackToProfiles}>
                    Back to profiles
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileContentsModal
        open={inspectedProfile !== null}
        onOpenChange={(open) => {
          if (!open) setInspectedProfile(null);
        }}
        profilePath={inspectedProfile?.path ?? ''}
        profileDisplayName={
          inspectedProfile ? inspectedProfile.displayName || inspectedProfile.name : ''
        }
        profileInspectionSupported={profileInspectionSupported}
        onInspectProfile={onInspectProfile}
      />
    </motion.div>
  );
}

import type { ApplyAction, ApplyItem } from '../types';
import type { EngineItemStatus, ItemEvent, EnginePhase } from './streaming-events';

/**
 * Canonical status keys used for filtering and internal logic.
 * These are the source of truth for status identification.
 * See docs/UX_LANGUAGE.md for the full contract.
 */
export type StatusKey =
  | 'to_install'      // Preview: will be installed
  | 'present'         // Already on system (label: "Already present")
  | 'detected'        // Capture: app detected on system
  | 'skipped'         // Skipped by filter/policy
  | 'failed'          // Failed (preview or apply)
  | 'installing'      // Apply activity: in progress
  | 'installed'       // Apply result: successfully installed
  | 'cancelled'       // User cancelled
  | 'manual';         // Requires manual installation

/**
 * Semantic color tokens for status display.
 * Maps to Tailwind CSS color classes.
 */
export type SemanticColor = 'success' | 'info' | 'warn' | 'error' | 'muted' | 'detected' | 'action';

/**
 * UI Status configuration with labels and colors.
 * Single source of truth for all status display.
 */
export interface UiStatusConfig {
  shortLabel: string;   // For live activity (compact)
  longLabel: string;    // For modals/summaries
  color: SemanticColor; // Semantic color token
}

/**
 * Complete UI status mapping - SINGLE SOURCE OF TRUTH.
 * Both Live Activity and Setup Details MUST consume this mapping.
 */
export const UI_STATUS_MAP: Record<StatusKey, UiStatusConfig> = {
  present: {
    shortLabel: 'PRESENT',
    longLabel: 'Already present',
    color: 'success',
  },
  to_install: {
    shortLabel: 'TO INSTALL',
    longLabel: 'To install',
    color: 'action',
  },
  detected: {
    shortLabel: 'DETECTED',
    longLabel: 'Detected',
    color: 'detected',
  },
  installing: {
    shortLabel: 'INSTALLING',
    longLabel: 'Installing…',
    color: 'info',
  },
  installed: {
    shortLabel: 'INSTALLED',
    longLabel: 'Installed',
    color: 'success',
  },
  skipped: {
    shortLabel: 'SKIPPED',
    longLabel: 'Skipped',
    color: 'warn',
  },
  failed: {
    shortLabel: 'FAILED',
    longLabel: 'Failed',
    color: 'error',
  },
  cancelled: {
    shortLabel: 'CANCELLED',
    longLabel: 'Cancelled',
    color: 'warn',
  },
  manual: {
    shortLabel: 'MANUAL',
    longLabel: 'Manual installation required',
    color: 'warn',
  },
} as const;

/**
 * Phase-aware UI status configuration.
 * Different phases use different language for the same underlying status.
 * 
 * Capture phase: Observational language (Detected, Present, Not found)
 * Apply phase: Action language (Installing, Installed, Already present, Failed)
 * Verify phase: Confirmation language (Confirmed, Missing, Version mismatch)
 */
export interface PhaseAwareStatusConfig {
  shortLabel: string;
  longLabel: string;
  color: SemanticColor;
}

/**
 * Phase-aware status labels - maps (phase, statusKey) to UI labels.
 * This is the SINGLE SOURCE OF TRUTH for phase-specific UI language.
 * 
 * Key semantic rules:
 * - Capture: "Skipped" with reason "already_installed" → "Detected" (green)
 * - Capture: Never shows "Skipped" - only "Detected" or "Not found"
 * - Apply: "present" → "Already present" (green, success - no action needed)
 * - Verify: "present" → "Confirmed" (green)
 * - Verify: "to_install" → "Missing" (red - needs attention)
 */
export const PHASE_STATUS_MAP: Record<UiPhase, Partial<Record<StatusKey, PhaseAwareStatusConfig>>> = {
  capture: {
    detected: { shortLabel: 'DETECTED', longLabel: 'Detected', color: 'detected' },
    present: { shortLabel: 'DETECTED', longLabel: 'Detected', color: 'detected' },
    installed: { shortLabel: 'DETECTED', longLabel: 'Detected', color: 'detected' },
    to_install: { shortLabel: 'NOT FOUND', longLabel: 'Not found', color: 'muted' },
    skipped: { shortLabel: 'EXCLUDED', longLabel: 'Excluded', color: 'muted' },
    failed: { shortLabel: 'ERROR', longLabel: 'Detection failed', color: 'error' },
    installing: { shortLabel: 'SCANNING', longLabel: 'Scanning…', color: 'info' },
    cancelled: { shortLabel: 'CANCELLED', longLabel: 'Cancelled', color: 'warn' },
  },
  preview: {
    present: { shortLabel: 'PRESENT', longLabel: 'Already present', color: 'success' },
    to_install: { shortLabel: 'TO INSTALL', longLabel: 'To install', color: 'action' },
    installing: { shortLabel: 'EVALUATING', longLabel: 'Evaluating…', color: 'info' },
    installed: { shortLabel: 'TO INSTALL', longLabel: 'To install', color: 'action' },
    skipped: { shortLabel: 'SKIPPED', longLabel: 'Skipped', color: 'muted' },
    failed: { shortLabel: 'FAILED', longLabel: 'Failed', color: 'error' },
    cancelled: { shortLabel: 'CANCELLED', longLabel: 'Cancelled', color: 'warn' },
    manual: { shortLabel: 'MANUAL', longLabel: 'Manual installation required', color: 'warn' },
  },
  apply: {
    present: { shortLabel: 'PRESENT', longLabel: 'Already present', color: 'success' },
    to_install: { shortLabel: 'TO INSTALL', longLabel: 'To install', color: 'action' },
    installing: { shortLabel: 'INSTALLING', longLabel: 'Installing…', color: 'info' },
    installed: { shortLabel: 'INSTALLED', longLabel: 'Installed', color: 'success' },
    skipped: { shortLabel: 'SKIPPED', longLabel: 'Skipped', color: 'warn' },
    failed: { shortLabel: 'FAILED', longLabel: 'Failed', color: 'error' },
    cancelled: { shortLabel: 'CANCELLED', longLabel: 'Cancelled', color: 'warn' },
    manual: { shortLabel: 'MANUAL', longLabel: 'Manual installation required', color: 'warn' },
  },
  verify: {
    present: { shortLabel: 'CONFIRMED', longLabel: 'Confirmed', color: 'success' },
    installed: { shortLabel: 'INSTALLED', longLabel: 'Installed', color: 'success' },
    to_install: { shortLabel: 'MISSING', longLabel: 'Missing', color: 'warn' },
    installing: { shortLabel: 'CHECKING', longLabel: 'Checking…', color: 'info' },
    skipped: { shortLabel: 'SKIPPED', longLabel: 'Skipped', color: 'warn' },
    failed: { shortLabel: 'FAILED', longLabel: 'Failed', color: 'error' },
    cancelled: { shortLabel: 'CANCELLED', longLabel: 'Cancelled', color: 'warn' },
  },
} as const;

/**
 * Get phase-aware UI status config.
 * Falls back to default UI_STATUS_MAP if phase-specific config not found.
 * 
 * @param statusKey - The canonical status key
 * @param phase - Optional UI phase for phase-specific labels
 * @returns UI status configuration with labels and color
 */
export function getPhaseAwareStatus(statusKey: StatusKey, phase?: UiPhase): PhaseAwareStatusConfig {
  if (phase && PHASE_STATUS_MAP[phase]?.[statusKey]) {
    return PHASE_STATUS_MAP[phase][statusKey]!;
  }
  return UI_STATUS_MAP[statusKey] || UI_STATUS_MAP.skipped;
}

/**
 * Arguments for reason-aware phase status resolution.
 */
export interface PhaseAwareStatusArgs {
  statusKey: StatusKey;
  phase?: UiPhase;
  reason?: string | null;
}

/**
 * Get phase-aware UI status config with reason discrimination.
 * This is the SINGLE SOURCE OF TRUTH for (phase, statusKey, reason) -> UI labels.
 * 
 * TRUTH TABLE: (phase, status, reason) -> StatusKey + Label + Color
 * ================================================================
 * 
 * APPLY PHASE:
 * - (apply, installing, *)           -> installing   | INSTALLING      | info
 * - (apply, installed, *)            -> installed    | INSTALLED       | success
 * - (apply, present, *)              -> present      | PRESENT         | success
 * - (apply, skipped, already_installed) -> present   | PRESENT         | success  ← NOT "Skipped"
 * - (apply, skipped, user_denied)    -> cancelled    | CANCELLED       | warn     ← User cancelled, NOT failed
 * - (apply, skipped, *)              -> skipped      | SKIPPED         | warn
 * - (apply, failed, install_failed)  -> failed       | FAILED          | error    ← Real install failure
 * - (apply, failed, *)               -> failed       | FAILED          | error
 * 
 * VERIFY PHASE:
 * - (verify, present, *)             -> present      | CONFIRMED       | success
 * - (verify, installed, *)           -> installed    | INSTALLED       | success
 * - (verify, skipped, already_installed) -> present  | CONFIRMED       | success
 * - (verify, failed, missing)        -> to_install   | MISSING         | warn     ← NOT failed, needs action
 * - (verify, failed, *)              -> failed       | FAILED          | error    ← Real verification error
 * - (verify, to_install, *)          -> to_install   | MISSING         | warn
 * 
 * CAPTURE PHASE:
 * - (capture, present, detected)     -> detected     | DETECTED        | detected
 * - (capture, detected, *)           -> detected     | DETECTED        | detected
 * - (capture, skipped, sensitive*)   -> skipped      | PROTECTED       | warn
 * - (capture, skipped, filtered*)    -> skipped      | EXCLUDED        | muted
 * - (capture, to_install, *)         -> to_install   | NOT FOUND       | muted
 * - (capture, failed, *)             -> failed       | ERROR           | error
 * 
 * Key semantic distinctions:
 * 1. User denial (apply, skipped, user_denied) -> CANCELLED (warn), NOT FAILED (error)
 * 2. Missing apps (verify, failed, missing) -> MISSING (warn), NOT FAILED (error)
 * 3. Already installed (apply, skipped, already_installed) -> PRESENT (success), NOT SKIPPED
 * 
 * @param args - Status key, phase, and optional reason
 * @returns UI status configuration with labels and color
 */
export function getPhaseAwareStatusForEvent(args: PhaseAwareStatusArgs): PhaseAwareStatusConfig {
  const { statusKey, phase, reason } = args;
  const reasonLower = reason?.toLowerCase() || '';

  // Capture phase: reason-aware discrimination
  if (phase === 'capture') {
    // skipped + sensitive_excluded -> PROTECTED (warn)
    if (statusKey === 'skipped' && (reasonLower === 'sensitive' || reasonLower === 'sensitive_excluded')) {
      return { shortLabel: 'PROTECTED', longLabel: 'Protected', color: 'warn' };
    }
    // skipped + filtered/filtered_runtime/filtered_store -> EXCLUDED (muted)
    if (statusKey === 'skipped' && (reasonLower === 'filtered' || reasonLower === 'filtered_runtime' || reasonLower === 'filtered_store')) {
      return { shortLabel: 'EXCLUDED', longLabel: 'Excluded', color: 'muted' };
    }
    // present + detected -> DETECTED (detected color)
    if (statusKey === 'present' && reasonLower === 'detected') {
      return { shortLabel: 'DETECTED', longLabel: 'Detected', color: 'detected' };
    }
    // Default capture phase handling
    if (PHASE_STATUS_MAP.capture[statusKey]) {
      return PHASE_STATUS_MAP.capture[statusKey]!;
    }
  }

  // Apply phase: reason-aware discrimination
  if (phase === 'apply') {
    // skipped + already_installed -> PRESENT (success), NOT "Skipped"
    if (statusKey === 'skipped' && (reasonLower === 'already_installed' || reasonLower === 'already_present')) {
      return { shortLabel: 'PRESENT', longLabel: 'Already present', color: 'success' };
    }
    // skipped + user_denied -> CANCELLED (warn) - user cancelled, not a failure
    if (statusKey === 'skipped' && reasonLower === 'user_denied') {
      return { shortLabel: 'CANCELLED', longLabel: 'User cancelled', color: 'warn' };
    }
    // skipped + manual_required -> MANUAL (warn) - requires manual installation
    if (statusKey === 'skipped' && reasonLower === 'manual_required') {
      return { shortLabel: 'MANUAL', longLabel: 'Manual installation required', color: 'warn' };
    }
    // manual status key (already resolved) -> MANUAL (warn)
    if (statusKey === 'manual') {
      return PHASE_STATUS_MAP.apply.manual!;
    }
    // Default apply phase handling
    if (PHASE_STATUS_MAP.apply[statusKey]) {
      return PHASE_STATUS_MAP.apply[statusKey]!;
    }
  }

  // Verify phase: reason-aware discrimination
  if (phase === 'verify') {
    // skipped + already_installed -> CONFIRMED (success)
    if (statusKey === 'skipped' && (reasonLower === 'already_installed' || reasonLower === 'already_present')) {
      return { shortLabel: 'CONFIRMED', longLabel: 'Confirmed', color: 'success' };
    }
    // failed + missing -> MISSING (warn) - not a real failure, just needs installation
    if (statusKey === 'failed' && reasonLower === 'missing') {
      return { shortLabel: 'MISSING', longLabel: 'Missing', color: 'warn' };
    }
    // Default verify phase handling
    if (PHASE_STATUS_MAP.verify[statusKey]) {
      return PHASE_STATUS_MAP.verify[statusKey]!;
    }
  }

  // Fall back to phase-aware status without reason, then to default
  return getPhaseAwareStatus(statusKey, phase);
}

/**
 * Get Tailwind color classes for a semantic color.
 * Returns { text, bg, border } classes.
 */
export function getColorClasses(color: SemanticColor): { text: string; bg: string; border: string } {
  switch (color) {
    case 'success':
      return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
    case 'info':
      return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    case 'action':
      // Action required: vivid blue, stronger border for emphasis
      return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/40' };
    case 'detected':
      return { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' };
    case 'warn':
      return { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
    case 'error':
      return { text: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' };
    case 'muted':
    default:
      return { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/20' };
  }
}

/**
 * Get UI status config for a StatusKey.
 */
export function getUiStatus(statusKey: StatusKey): UiStatusConfig {
  return UI_STATUS_MAP[statusKey] || UI_STATUS_MAP.skipped;
}

/**
 * Get semantic color for a given phase.
 * Used for phase-aware UI elements like spinners and progress indicators.
 * 
 * @param phase - The UI phase
 * @returns Semantic color token
 */
export function getPhaseColor(phase?: UiPhase): SemanticColor {
  switch (phase) {
    case 'capture':
      return 'info'; // Blue
    case 'preview':
      return 'info'; // Blue/neutral for preview
    case 'apply':
      return 'success'; // Green
    case 'verify':
      return 'warn'; // Amber
    default:
      return 'info'; // Default to info (neutral)
  }
}

/**
 * Map engine streaming status to UI StatusKey.
 * This is the SINGLE SOURCE OF TRUTH for streaming event status mapping.
 * 
 * Engine Status -> UI StatusKey:
 * - present     -> present (green)
 * - to_install  -> to_install (blue)
 * - installing  -> installing (blue)
 * - installed   -> installed (green)
 * - captured    -> detected (teal; compatibility with engine v2.24.1)
 * - skipped     -> skipped (yellow)
 * - failed      -> failed (red)
 */
export function engineStatusToStatusKey(engineStatus: EngineItemStatus, phase?: EnginePhase): StatusKey {
  switch (engineStatus) {
    case 'present':
      return 'present';
    case 'to_install':
      return 'to_install';
    case 'installing':
      return 'installing';
    case 'installed':
      return 'installed';
    case 'skipped':
      return 'skipped';
    case 'failed':
      return 'failed';
    case 'captured':
      if (phase === 'capture') return 'detected';
      throw new Error('Deprecated captured status is only valid during capture');
    default:
      throw new Error(`Unsupported engine item status: ${String(engineStatus)}`);
  }
}

/**
 * Convert an ItemEvent from streaming to an AppEvent for UI display.
 * Uses EnginePhase which includes 'plan' | 'apply' | 'verify' | 'capture'.
 * Note: 'plan' phase maps to 'apply' for UI purposes (preview behaves like apply).
 */
export function itemEventToAppEvent(event: ItemEvent, phase?: EnginePhase): AppEvent {
  // Map streaming phase to UI-relevant phase (apply | verify | capture)
  // 'plan' phase maps to 'apply' for UI purposes (preview behaves like apply)
  const uiPhase: UiPhase | undefined = 
    phase === 'apply' ? 'apply' : 
    phase === 'plan' ? 'apply' :
    phase === 'verify' ? 'verify' : 
    phase === 'capture' ? 'capture' :
    undefined;
  
  // Determine action text with fallback for failed items with no message
  const statusKey = engineStatusToStatusKey(event.status, phase);
  let action = event.message || event.status;
  if (statusKey === 'failed' && (!event.message || !event.message.trim())) {
    action = 'Install failed (no details provided)';
  }
  
  return {
    app: event.id,
    action,
    timestamp: Date.now(),
    statusKey,
    phase: uiPhase,
    reason: event.reason,
    name: event.name,
    driver: event.driver,
  };
}

/**
 * Canonical UI labels per UX_LANGUAGE.md contract.
 * @deprecated Use UI_STATUS_MAP instead for new code.
 */
export const STATUS_LABELS = {
  // Preview decision labels
  preview: {
    to_install: 'To install',
    already_present: 'Already present',
    skipped: 'Skipped',
    failed: 'Failed (preview)',
  },
  // Apply activity verbs (in-progress)
  activity: {
    installing: 'Installing…',
    skipping: 'Skipping…',
    verifying: 'Verifying…',
    failed: 'Failed',
  },
  // Apply result labels (terminal states)
  result: {
    installed: 'Installed',
    already_present: 'Already present',
    skipped: 'Skipped',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
} as const;

/**
 * Map engine reason to canonical StatusKey.
 * This is the single source of truth for status normalization.
 */
export function reasonToStatusKey(item: ApplyItem): StatusKey {
  const reason = item.reason?.toLowerCase() || '';
  const status = item.status?.toLowerCase() || '';

  // Failed states
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return 'failed';
  }

  // User denied/cancelled
  if (reason === 'user_denied') {
    return 'cancelled';
  }

  // Manual installation required
  if (reason === 'manual_required') {
    return 'manual';
  }

  // Installed this run
  if (reason === 'installed') {
    return 'installed';
  }

  // Already present
  if (reason === 'already_installed' || reason === 'already_present') {
    return 'present';
  }

  // Would install (preview)
  if (reason === 'would_install') {
    return 'to_install';
  }

  // Skipped/filtered
  if (status === 'skipped' || reason === 'skipped' || reason === 'filtered') {
    return 'skipped';
  }

  // OK status without reason = already present
  if (status === 'ok') {
    return 'present';
  }

  // Fallback
  return 'skipped';
}

/**
 * Get the user-facing label for a status key in a given phase.
 */
export function getStatusLabel(
  statusKey: StatusKey,
  phase: 'preview' | 'activity' | 'result'
): string {
  if (phase === 'preview') {
    if (statusKey === 'to_install') return STATUS_LABELS.preview.to_install;
    if (statusKey === 'present') return STATUS_LABELS.preview.already_present;
    if (statusKey === 'manual') return 'Manual installation required';
    if (statusKey === 'skipped' || statusKey === 'cancelled') return STATUS_LABELS.preview.skipped;
    if (statusKey === 'failed') return STATUS_LABELS.preview.failed;
    return STATUS_LABELS.preview.skipped;
  }
  
  if (phase === 'activity') {
    if (statusKey === 'installing') return STATUS_LABELS.activity.installing;
    if (statusKey === 'failed') return STATUS_LABELS.activity.failed;
    return STATUS_LABELS.activity.verifying;
  }
  
  // Result phase
  if (statusKey === 'installed') return STATUS_LABELS.result.installed;
  if (statusKey === 'present') return STATUS_LABELS.result.already_present;
  if (statusKey === 'manual') return 'Manual installation required';
  if (statusKey === 'skipped') return STATUS_LABELS.result.skipped;
  if (statusKey === 'failed') return STATUS_LABELS.result.failed;
  if (statusKey === 'cancelled') return STATUS_LABELS.result.cancelled;
  return STATUS_LABELS.result.skipped;
}

/**
 * Get the canonical filter key for a status.
 * Used for filtering lists by status.
 */
export function getFilterKey(item: ApplyItem): StatusKey {
  return reasonToStatusKey(item);
}

// EnginePhase is imported from streaming-events.ts (single source of truth)
// Re-export for consumers that import from apply-utils
export type { EnginePhase } from './streaming-events';

/**
 * UI phases for display.
 * 'plan' phase from engine is not displayed in UI.
 * 'capture' is a UI-only phase for the capture flow.
 * 'preview' is for apply --dry-run operations (neutral styling).
 */
export type UiPhase = 'capture' | 'apply' | 'verify' | 'preview';

/**
 * AppEvent represents a live activity entry during streaming.
 */
export interface AppEvent {
  app: string;
  action: string;
  timestamp?: number;
  statusKey?: StatusKey;  // Canonical status for consistent display
  phase?: UiPhase;        // Which phase this event occurred in (UI-relevant only)
  reason?: string | null; // Engine reason for status discrimination (e.g., 'filtered', 'sensitive', 'already_installed')
  /** Friendly display name from engine (e.g., "Visual Studio Code") */
  name?: string;
  /** Engine driver (e.g., "winget", "manual"). Manual entries are synthesized config-only apps. */
  driver?: string;
  /**
   * Row kind. Undefined/'app' is an installable app row (default). 'restore' is
   * a config-restore row (RESTORING/RESTORED verbs, engine-named); 'artifact' is
   * a produced-artifact completion line (e.g. the saved profile bundle). These
   * rows carry their friendly display via `name`/`secondary` and never surface
   * raw engine copy-spec text.
   */
  kind?: 'app' | 'restore' | 'artifact';
  /** Terminal/transitional restore status, when kind === 'restore'. */
  restoreStatus?: RestoreStatusKey;
  /** Friendly muted secondary line (skip reason, artifact name). */
  secondary?: string;
  /** Full raw detail for a hover title / disclosure only (never inline text). */
  title?: string;
}

/**
 * UI categories for Apply results.
 * 
 * These are semantic categories that map to user-facing labels:
 * - willBeInstalled: apps that will be installed (from dry-run preview)
 * - installedThisRun: apps that were installed during this apply run
 * - alreadyPresent: apps that were already on the system
 * - needsAttention: apps that failed to install
 * - skipped: apps skipped by filter/policy (advanced, hidden by default)
 */
export type ApplyCategory = 'willBeInstalled' | 'installedThisRun' | 'alreadyPresent' | 'needsAttention' | 'skipped';

/**
 * Categorized item with normalized status.
 */
export interface CategorizedApplyItem extends ApplyItem {
  category: ApplyCategory;
}

/**
 * Grouped items by category and driver.
 */
export interface CategorizedApplyGroups {
  willBeInstalled: Record<string, ApplyItem[]>;
  installedThisRun: Record<string, ApplyItem[]>;
  alreadyPresent: Record<string, ApplyItem[]>;
  needsAttention: Record<string, ApplyItem[]>;
  skipped: Record<string, ApplyItem[]>;
}

/**
 * Map engine reason to UI category.
 * 
 * Engine reason values → UI category:
 * - would_install → willBeInstalled (preview only)
 * - installed → installedThisRun (apply only)
 * - already_installed → alreadyPresent
 * - install_failed → needsAttention
 * - skipped_filtered → skipped
 * - user_denied → skipped (shown as "Cancelled")
 */
export function normalizeApplyStatus(item: ApplyItem): ApplyCategory {
  const status = item.status?.toLowerCase() || '';
  const reason = item.reason?.toLowerCase() || '';

  // Failed always maps to needsAttention
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return 'needsAttention';
  }

  // would_install = preview showing what will be installed
  if (reason === 'would_install') {
    return 'willBeInstalled';
  }

  // installed = actually installed this run
  if (reason === 'installed') {
    return 'installedThisRun';
  }

  // already_installed = already present on system
  if (reason === 'already_installed') {
    return 'alreadyPresent';
  }

  // manual_required = needs manual installation (maps to needsAttention for count purposes)
  if (reason === 'manual_required') {
    return 'needsAttention';
  }

  // user_denied = user cancelled/denied the install
  if (reason === 'user_denied') {
    return 'skipped';
  }

  // OK status without specific reason - check if it's a dry-run or real apply
  if (status === 'ok') {
    // Default to installedThisRun for ok status without reason
    return 'installedThisRun';
  }

  // Skipped for other reasons = filtered/policy skip
  if (status === 'skipped') {
    return 'skipped';
  }

  // Fallback: unknown status treated as skipped
  return 'skipped';
}

/**
 * Categorize and group apply items by category and driver.
 */
export function categorizeApplyItems(items: ApplyItem[]): CategorizedApplyGroups {
  const groups: CategorizedApplyGroups = {
    willBeInstalled: {},
    installedThisRun: {},
    alreadyPresent: {},
    needsAttention: {},
    skipped: {},
  };

  for (const item of items) {
    const category = normalizeApplyStatus(item);
    const driver = item.driver || 'unknown';

    if (!groups[category][driver]) {
      groups[category][driver] = [];
    }
    groups[category][driver].push(item);
  }

  return groups;
}

/**
 * Count items in each category.
 */
export function countCategorizedItems(groups: CategorizedApplyGroups): {
  willBeInstalled: number;
  installedThisRun: number;
  alreadyPresent: number;
  needsAttention: number;
  skipped: number;
} {
  const countGroup = (group: Record<string, ApplyItem[]>) =>
    Object.values(group).reduce((sum, items) => sum + items.length, 0);

  return {
    willBeInstalled: countGroup(groups.willBeInstalled),
    installedThisRun: countGroup(groups.installedThisRun),
    alreadyPresent: countGroup(groups.alreadyPresent),
    needsAttention: countGroup(groups.needsAttention),
    skipped: countGroup(groups.skipped),
  };
}

/**
 * Determine if the apply result indicates "ready" state.
 * 
 * Ready = no failures AND no pending installs.
 * "Your computer is ready" ONLY when:
 * - No failures
 * - No pending installs (willBeInstalled = 0)
 * 
 * @param itemCounts - Counts derived from categorizing items
 */
export function isApplyReady(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  // Not ready if there are failures
  if (itemCounts.needsAttention > 0) {
    return false;
  }
  // Not ready if there are pending installs (preview mode)
  if (itemCounts.willBeInstalled > 0) {
    return false;
  }
  // Ready if we have no failures and no pending
  return true;
}

/**
 * Determine if this is a preview result (has pending installs).
 */
export function isPreviewResult(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  return itemCounts.willBeInstalled > 0;
}

/**
 * Determine if all apps are already present (nothing to install).
 */
export function isAllAlreadyPresent(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  // All already present = no pending installs, no new installs, no failures, and at least one already present
  const noPending = itemCounts.willBeInstalled === 0;
  const noNewInstalls = itemCounts.installedThisRun === 0;
  const noFailures = itemCounts.needsAttention === 0;
  const hasAlreadyPresent = itemCounts.alreadyPresent > 0;

  return noPending && noNewInstalls && noFailures && hasAlreadyPresent;
}

/**
 * Build the value for `apply --only <ids>` from the selected manifest app ids.
 *
 * Pure presentation-to-CLI translation: blank entries are dropped and
 * duplicates removed. The GUI must never emit an empty/blank `--only` (the
 * engine rejects it with MANIFEST_VALIDATION_ERROR), so this returns null
 * when the input yields no ids — callers must then OMIT the flag entirely,
 * leaving behavior unchanged.
 */
export function buildOnlyFlagValue(ids: string[] | undefined | null): string | null {
  if (!ids || ids.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length > 0 ? out.join(',') : null;
}

/**
 * Result from parsing a streaming log line.
 */
export interface ParsedProgressLine {
  app: string;
  action: string;
  statusKey: StatusKey;
  isPhaseMarker?: boolean;  // True if this line indicates a phase transition
  phase?: UiPhase;          // The phase this event belongs to (UI-relevant only)
}

/**
 * Detect if a line indicates the start of verification phase.
 * Returns true if the line signals transition from apply to verify.
 */
export function isVerifyPhaseMarker(line: string): boolean {
  if (!line) return false;
  const lower = line.toLowerCase();
  return lower.includes('verifying') || 
         lower.includes('verification') ||
         lower.includes('[verify]') ||
         lower.includes('checking installation');
}

/**
 * Parse a streaming log line to extract current app and action.
 * Returns null if the line doesn't contain app progress info.
 * 
 * Patterns matched:
 * - [OK] App.Id (driver: winget) - already installed
 * - [OK] App.Id (driver: winget) - Installed successfully
 * - [INSTALL] App.Id (driver: winget)
 * - [SKIP] App.Id - already installed
 * - [SKIP] App.Id - filtered
 * - [FAIL] App.Id - error message
 * - [MISSING] App.Id (driver: winget)
 * - [ACTION] Installing App.Id via winget
 * - [PLAN] App.Id - would install
 * - Found Discord.Discord [Discord.Discord]
 * - Installing Discord.Discord...
 * - Successfully installed Discord.Discord
 */
export function parseApplyProgressLine(line: string): { app: string; action: string; statusKey?: StatusKey } | null {
  if (!line || typeof line !== 'string') {
    return null;
  }

  // [OK] App.Id (driver: ...) - message
  // [OK] means verified/present - NOT the same as Skipped or Installed
  // Keep it truthful: OK means "verified OK" not "skipped" or "installed"
  const okMatch = line.match(/\[OK\]\s+(\S+)/i);
  if (okMatch) {
    return { app: okMatch[1], action: 'OK', statusKey: 'present' };
  }

  // [INSTALL] App.Id (driver: ...) - this is the START of an install, not completion
  // Treat as "Processing" - the actual result comes later
  const installMatch = line.match(/\[INSTALL\]\s+(\S+)/i);
  if (installMatch) {
    return { app: installMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  // [PLAN] App.Id - to install (preview)
  const planMatch = line.match(/\[PLAN\]\s+(\S+)/i);
  if (planMatch) {
    return { app: planMatch[1], action: 'To install', statusKey: 'to_install' };
  }

  // [ACTION] Installing App.Id via winget - this is processing, not completion
  const actionMatch = line.match(/\[ACTION\]\s+(?:Installing|Checking)\s+(\S+)/i);
  if (actionMatch) {
    return { app: actionMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  // [SKIP] App.Id - reason
  // CRITICAL: Check reason to distinguish "already installed" from true skips
  const skipMatch = line.match(/\[SKIP\]\s+(\S+)(?:\s+-\s+(.+))?/i);
  if (skipMatch) {
    const app = skipMatch[1];
    const reason = skipMatch[2]?.toLowerCase() || '';
    
    // If skipped because already installed/present, map to OK (already present)
    if (reason.includes('already installed') || reason.includes('already present') || reason.includes('no action')) {
      return { app, action: 'OK', statusKey: 'present' };
    }
    
    // Otherwise it's a true skip (filtered, policy, etc.)
    return { app, action: 'Skipped', statusKey: 'skipped' };
  }

  // [FAIL] App.Id - error
  const failMatch = line.match(/\[FAIL\]\s+(\S+)/i);
  if (failMatch) {
    return { app: failMatch[1], action: 'Failed', statusKey: 'failed' };
  }

  // [MISSING] App.Id (driver: ...) - maps to to_install for verify phase
  const missingMatch = line.match(/\[MISSING\]\s+(\S+)/i);
  if (missingMatch) {
    return { app: missingMatch[1], action: 'Missing', statusKey: 'to_install' };
  }

  // [VERSION] App.Id - version mismatch
  const versionMatch = line.match(/\[VERSION\]\s+(\S+)/i);
  if (versionMatch) {
    return { app: versionMatch[1], action: 'Version mismatch', statusKey: 'failed' };
  }

  // Winget-style: Found/Installing/Successfully installed App.Name [App.Id]
  const wingetMatch = line.match(/(?:Found|Installing|Successfully installed)\s+[^\[]*\[([^\]]+)\]/i);
  if (wingetMatch) {
    // Only "Successfully installed" is a definitive install - others are processing
    if (line.toLowerCase().includes('successfully installed')) {
      return { app: wingetMatch[1], action: 'Installed', statusKey: 'installed' };
    }
    return { app: wingetMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  return null;
}

/**
 * Streaming line buffer for handling partial lines.
 * Accumulates data and yields complete lines.
 */
export class StreamingLineBuffer {
  private buffer: string = '';

  /**
   * Append data to the buffer and return complete lines.
   */
  append(data: string): string[] {
    this.buffer += data;
    const lines: string[] = [];
    
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      // Trim carriage return if present (Windows line endings)
      lines.push(line.replace(/\r$/, ''));
    }
    
    return lines;
  }

  /**
   * Get any remaining partial line in the buffer.
   */
  getRemaining(): string {
    return this.buffer;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = '';
  }
}

/**
 * Map engine item reason to a user-friendly action string and statusKey for live activity.
 * This is the source of truth for how items appear in the live activity list.
 */
export function reasonToAction(
  // Accepts both shapes that carry a status/reason pair: streamed ApplyItems and
  // the envelope's ApplyActions. Only these two fields are read, so a structural
  // parameter keeps one mapping authoritative for both instead of forking it.
  item: { status?: string; reason?: string | null }
): { action: string; statusKey: StatusKey } {
  const reason = item.reason?.toLowerCase() || '';
  const status = item.status?.toLowerCase() || '';

  // Failed states
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return { action: 'Failed', statusKey: 'failed' };
  }

  // Terminal statuses from the envelope's actions[]. The streamed item events
  // handled below use a different vocabulary (status ok/skipped plus a reason),
  // while the engine's authoritative results carry the state in `status`
  // itself. Checked first so an envelope result is never reinterpreted through
  // a streamed event's reason.
  if (status === 'installed') {
    return { action: 'Installed', statusKey: 'installed' };
  }
  if (status === 'present') {
    return { action: 'OK', statusKey: 'present' };
  }
  if (status === 'to_install') {
    return { action: 'To install', statusKey: 'to_install' };
  }

  // User denied/cancelled
  if (reason === 'user_denied') {
    return { action: 'Cancelled', statusKey: 'cancelled' };
  }

  // Manual installation required
  if (reason === 'manual_required') {
    return { action: 'Manual', statusKey: 'manual' };
  }

  // Installed this run
  if (reason === 'installed') {
    return { action: 'Installed', statusKey: 'installed' };
  }

  // Already present
  if (reason === 'already_installed') {
    return { action: 'OK', statusKey: 'present' };
  }

  // To install (preview) - canonical label per UX_LANGUAGE.md
  if (reason === 'would_install') {
    return { action: 'To install', statusKey: 'to_install' };
  }

  // Skipped/filtered
  if (status === 'skipped' || reason === 'skipped' || reason === 'filtered') {
    return { action: 'Skipped', statusKey: 'skipped' };
  }

  // OK status without reason
  if (status === 'ok') {
    return { action: 'OK', statusKey: 'present' };
  }

  // Fallback
  return { action: 'Unknown', statusKey: 'skipped' };
}

/**
 * Legacy wrapper for reasonToAction that returns just the action string.
 * @deprecated Use reasonToAction directly and access .action property.
 */
export function reasonToActionString(item: ApplyItem): string {
  return reasonToAction(item).action;
}

/**
 * Reconcile live activity events with the final JSON envelope.
 * 
 * This function takes the streaming live activity state and reconciles it
 * with the authoritative final JSON envelope from the engine. This ensures:
 * - Any "Working..." entries are updated to their final status
 * - Failed items show as "Failed" even if streaming missed the failure
 * - Items with null message get a fallback message
 * 
 * @param liveEvents - Current live activity events from streaming
 * @param envelopeActions - Final per-app results from the JSON envelope's
 *   `actions[]` (source of truth). Note this is `actions`, not `items`: the
 *   apply envelope has never carried an `items` field, and reconciling against
 *   it meant this function silently never ran.
 * @returns Reconciled app events with correct final statuses
 */
export function reconcileLiveActivity(
  liveEvents: AppEvent[],
  envelopeActions: ApplyAction[]
): AppEvent[] {
  // Streaming-only runs (cancel/crash with no terminal envelope) keep their live
  // rows untouched — there is no authoritative list to reconcile against.
  if (!envelopeActions || envelopeActions.length === 0) {
    return [...liveEvents];
  }

  // Alias map: the engine keys streamed item events by the winget `ref`, but the
  // envelope's authoritative actions are keyed by the manifest `id`
  // (`ApplyAction{ID: app.ID, Ref: route.ref}`). When ref != id, matching only
  // by id left the ref-keyed live row AND the id-keyed envelope row both
  // standing — the app rendered twice (once per identifier, and again per
  // apply/verify phase in a single spawn). Canonicalising every alias to its
  // action id collapses them into ONE envelope-authoritative row.
  const idByAlias = new Map<string, string>();
  for (const action of envelopeActions) {
    idByAlias.set(action.id, action.id);
    if (action.ref) idByAlias.set(action.ref, action.id);
  }
  const canonicalKey = (event: AppEvent): string => idByAlias.get(event.app) ?? event.app;

  // Build the envelope-authoritative row for an action, preserving phase/context
  // from the matching live row. `name`/`driver` are carried forward — dropping
  // them made a reconciled row fall back to the raw package ref, which is how a
  // never-installed app rendered as "Warp.Warp" beside friendly-named rows.
  const buildRow = (action: ApplyAction, existing: AppEvent | undefined): AppEvent => {
    const { action: actionLabel, statusKey } = reasonToAction(action);
    return {
      app: action.id,
      action: actionLabel,
      statusKey,
      timestamp: existing?.timestamp ?? Date.now(),
      phase: existing?.phase,
      reason: action.reason ?? existing?.reason,
      name: action.name ?? existing?.name,
      driver: action.driver ?? existing?.driver,
    };
  };

  const resultMap = new Map<string, AppEvent>();
  // Live rows first, keyed by their canonical (action) identity. Restore /
  // artifact / phase-header rows are not envelope actions, so their alias is
  // absent and they pass through under their own key unchanged.
  for (const event of liveEvents) {
    resultMap.set(canonicalKey(event), event);
  }
  // Envelope is source of truth for app-row status — overwrite matched rows.
  for (const action of envelopeActions) {
    resultMap.set(action.id, buildRow(action, resultMap.get(action.id)));
  }

  const result: AppEvent[] = [];
  const seen = new Set<string>();
  // Preserve the order the user watched stream in, each canonical row once.
  for (const event of liveEvents) {
    const key = canonicalKey(event);
    if (!seen.has(key)) {
      const row = resultMap.get(key);
      if (row) {
        result.push(row);
        seen.add(key);
      }
    }
  }
  // Then any envelope action that never appeared live (fast-resolved items).
  for (const action of envelopeActions) {
    if (!seen.has(action.id)) {
      const row = resultMap.get(action.id);
      if (row) {
        result.push(row);
        seen.add(action.id);
      }
    }
  }

  return result;
}

/**
 * Get a user-friendly message for a failed item.
 * If the item has no message, returns a fallback.
 */
export function getFailedItemMessage(item: ApplyItem): string {
  if (item.message && item.message.trim()) {
    return item.message;
  }
  return 'Install failed (no details returned)';
}

/**
 * Restore-specific status keys.
 * Parallel to StatusKey but for config restore operations.
 */
export type RestoreStatusKey =
  | 'restoring'
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

/** Restore status UI mapping */
export const RESTORE_STATUS_MAP: Record<RestoreStatusKey, UiStatusConfig> = {
  restoring: {
    shortLabel: 'RESTORING',
    longLabel: 'Restoring\u2026',
    color: 'info',
  },
  restored: {
    shortLabel: 'RESTORED',
    longLabel: 'Restored',
    color: 'success',
  },
  skipped_up_to_date: {
    shortLabel: 'UP TO DATE',
    longLabel: 'Already up to date',
    color: 'muted',
  },
  skipped_missing_source: {
    shortLabel: 'MISSING',
    longLabel: 'Source missing',
    color: 'warn',
  },
  failed: {
    shortLabel: 'FAILED',
    longLabel: 'Failed',
    color: 'error',
  },
} as const;

/**
 * Get UI status config for a restore status key.
 */
export function getRestoreUiStatus(status: RestoreStatusKey): UiStatusConfig {
  return RESTORE_STATUS_MAP[status] ?? RESTORE_STATUS_MAP.failed;
}

/**
 * Resolve an AppEvent's statusKey, applying the legacy action-string fallback
 * used by live activity render sites when `statusKey` is absent.
 */
function deriveStatusKey(event: AppEvent): StatusKey {
  if (event.statusKey) return event.statusKey;
  switch (event.action) {
    case 'OK': return 'present';
    case 'Installed': return 'installed';
    case 'Failed': return 'failed';
    case 'Skipped': return 'skipped';
    case 'Cancelled': return 'cancelled';
    case 'Processing': return 'installing';
    case 'To install': return 'to_install';
    default: return 'skipped';
  }
}

/**
 * Single source of truth for an activity row's short status label + color.
 *
 * Restore rows use the RESTORING/RESTORED/UP TO DATE/MISSING/FAILED vocabulary
 * (never the app "INSTALLING" verb); artifact rows render a muted SAVED
 * completion marker; app rows fall through to the phase-aware app mapping. The
 * optional `phaseOverride` lets a render site pin the phase for app rows (e.g. a
 * results list that always reads as "apply") while restore/artifact rows ignore
 * it.
 */
export function getActivityRowLabel(
  event: AppEvent,
  phaseOverride?: UiPhase,
): { shortLabel: string; color: SemanticColor } {
  if (event.kind === 'restore') {
    const cfg = getRestoreUiStatus(event.restoreStatus ?? 'failed');
    return { shortLabel: cfg.shortLabel, color: cfg.color };
  }
  if (event.kind === 'artifact') {
    return { shortLabel: 'SAVED', color: 'muted' };
  }
  const cfg = getPhaseAwareStatusForEvent({
    statusKey: deriveStatusKey(event),
    phase: phaseOverride ?? event.phase,
    reason: event.reason,
  });
  return { shortLabel: cfg.shortLabel, color: cfg.color };
}

/**
 * Derive LiveCounters from a slice of visible AppEvents.
 * Used by the visual event buffer to keep counter badges in sync with
 * the revealed (visible) events rather than the full event list.
 */
export function deriveCountersFromEvents(events: AppEvent[]): import('../components/app/overview/types').LiveCounters {
  const counters = {
    installed: 0,
    alreadyPresent: 0,
    skipped: 0,
    failed: 0,
    configsRestored: 0,
    configsSkipped: 0,
    configsFailed: 0,
  };

  for (const event of events) {
    // Skip phase header events
    if (event.app === '── APPLY ──' || event.app === '── VERIFY ──') continue;

    // Artifact completion lines carry no installable/restore count.
    if (event.kind === 'artifact') continue;

    const isRestore = event.kind === 'restore' || event.app.startsWith('\u2699');
    const sk = event.statusKey;

    if (isRestore) {
      if (sk === 'installed') counters.configsRestored++;
      else if (sk === 'skipped') counters.configsSkipped++;
      else if (sk === 'failed') counters.configsFailed++;
    } else {
      // Skip intermediate statuses — only count final outcomes
      if (sk === 'installing' || sk === 'to_install') continue;
      if (sk === 'installed') counters.installed++;
      else if (sk === 'present') counters.alreadyPresent++;
      else if (sk === 'skipped') counters.skipped++;
      else if (sk === 'failed' || sk === 'manual') counters.failed++;  // manual counts as needing attention
    }
  }

  return counters;
}

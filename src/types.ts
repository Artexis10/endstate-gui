export interface EndstateEnvelope<T = unknown> {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
  timestampUtc: string;
  success: boolean;
  data: T;
  error: EndstateError | null;
}

export interface EndstateError {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  remediation?: string;
  docsKey?: string;
  hint?: string;
}

/** Engine-owned compatibility decision for one captured configuration set. */
export type ConfigResolutionKind =
  | 'direct'
  | 'migrate'
  | 'incompatible'
  | 'unknown'
  | 'legacy_unverified';

/** Terminal configuration outcome from a completed command envelope. */
export type ConfigResolutionStatus =
  | 'planned'
  | 'restored'
  | 'skipped'
  | 'failed'
  | 'rolled_back'
  | 'rollback_failed';

/** Portable detection evidence supplied by the engine. Extra keys are additive. */
export interface ConfigDetectionEvidence {
  type: string;
  appId?: string;
  backend?: string;
  platform?: string;
  ref?: string;
  driver?: string;
  [key: string]: unknown;
}

/** Portable, non-secret source instance supplied by the engine. */
export interface ConfigInstanceEvidence {
  id: string;
  detectorId: string;
  rawVersion: string;
  normalizedVersion: string;
  evidence: ConfigDetectionEvidence;
}

/** Portable target candidate supplied by the engine. */
export interface ConfigTargetCandidate {
  id: string;
  moduleId: string;
  detectorId: string;
  rawVersion: string;
  normalizedVersion: string;
  evidence: ConfigDetectionEvidence;
  targetGeneration?: string;
  targetGenerationFingerprint?: string;
  restoreModuleRevision: string;
}

/** Final engine result for one captured configuration set. */
export interface ConfigResolution {
  captureId: string;
  moduleId: string;
  configSetId: string;
  sourceInstance?: ConfigInstanceEvidence;
  sourceInstanceId?: string;
  targetInstanceId?: string;
  targetCandidates: ConfigTargetCandidate[];
  sourceGeneration?: string;
  sourceGenerationFingerprint?: string;
  targetGeneration?: string;
  resolution: ConfigResolutionKind;
  reason: string | null;
  migrationPath: string[];
  captureModuleRevision?: string;
  restoreModuleRevision?: string;
  resolvedTargets: string[];
  status: ConfigResolutionStatus;
  label: string;
  message: string;
  remediation: string | null;
}

/** Engine-owned aggregate counts for configuration resolutions. */
export interface ConfigResolutionSummary {
  total: number;
  direct: number;
  migrate: number;
  incompatible: number;
  unknown: number;
  legacyUnverified: number;
  selected: number;
  skipped: number;
  failed: number;
}

/** Explicit capture-to-target choice passed back to the engine. */
export interface RestoreTargetMapping {
  captureId: string;
  targetInstanceId: string;
}

/** Explicit GUI choices supplied to `apply`; omitted fields keep engine defaults. */
export interface ApplyRestoreOptions {
  restoreIntent?: RestoreIntent;
  selectedModules?: string[];
  onlyAppIds?: string[];
  restoreTargets?: RestoreTargetMapping[];
  /**
   * Engine display-name context from the preview envelope, threaded so live
   * restore rows resolve `<module> · <file>` (e.g. "Notepad++ · contextMenu.xml")
   * during streaming rather than only after the terminal envelope lands.
   */
  configModuleMap?: Record<string, string>;
  restoreModulesAvailable?: RestoreModuleRef[];
}

/** Engine-authored advisory attached to a completed command result. */
export interface CommandWarning {
  code: string;
  message: string;
  driver?: string;
  ref?: string;
}

export interface EndstateHostedBackupCapability {
  supported: boolean;
  /**
   * Engine-normalized identity of the effective backup provider. This is the
   * only signal the GUI may use for Endstate Cloud eligibility; absent or
   * unknown values keep the invitation dark for older engines.
   */
  providerKind?: 'endstate-cloud' | 'self-hosted' | 'unknown';
  minSchemaVersion?: string;
  issuerUrl?: string;
  audience?: string;
  /**
   * True when the engine supports `backup push --if-changed` (content-hash
   * dedup). Tolerant fallback for the capability gate; the canonical signal is
   * `--if-changed` appearing in the backup command's advertised flags. Absent
   * until engine #62 / task 0.3 lands → auto-backup stays dark.
   */
  ifChanged?: boolean;
  /**
   * True when the engine supports `backup rename` (mutable backup labels via
   * PATCH). Rename reuses `--backup-id`/`--name`, so it cannot be probed via the
   * flag list — this explicit boolean is the only signal. Absent until the
   * engine ships it → the GUI's rename affordance stays hidden.
   */
  rename?: boolean;
}

export interface EndstateCapabilitiesData {
  supportedSchemaVersions?: {
    min: string;
    max: string;
  };
  commands?: string[] | Record<string, { flags?: string[] }>;
  features?: {
    streaming?: boolean;
    parallelInstall?: boolean;
    configModules?: boolean;
    /** Additive read-only `profile inspect` capability (engine v2.30+). */
    profileInspection?: boolean;
    jsonOutput?: boolean;
    manualApps?: boolean;
    hostedBackup?: EndstateHostedBackupCapability;
    /**
     * Scheduled setup-check capability. Additive in
     * schema 1.x; absent on engines that predate the `schedule` command family
     * (≤ 2.21) → the entire feature stays dark. `supported` is true only on
     * Windows where schtasks.exe is available; `autoPush` advertises that
     * `schedule run` can capture+push via the persisted keychain session.
     */
    schedule?: {
      supported: boolean;
      autoPush: boolean;
      /** Engine can read a manifest directly from .endstate and legacy .zip bundles. */
      bundleManifestSupported?: boolean;
    };
  };
  platform?: {
    os: string;
    drivers: string[];
  };
  gitCommit?: string | null;
  gitDirty?: boolean;
  bootstrapTimestamp?: string | null;
}

/** Engine-authored ownership classification for one app-settings row. */
export type ProfileInspectionAssociationStatus =
  | 'included'
  | 'not_in_profile'
  | 'ambiguous'
  | 'unresolved';

/** Impact level for an engine-authored profile-inspection warning. */
export type ProfileInspectionWarningImpact = 'diagnostic' | 'inventory_incomplete';

/** Saved-profile identity reported by `endstate profile inspect --json`. */
export interface ProfileInspectionProfile {
  name: string | null;
  capturedAt: string | null;
  manifestVersion: number;
  manifestPath: string;
}

/** Finalized inspection counts, derived by the engine from returned rows. */
export interface ProfileInspectionSummary {
  appCount: number;
  settingsRowCount: number;
  verifiedSettingsAppCount: number;
  unidentifiedSettingsRowCount: number;
}

/** One Apps-inventory row from the read-only profile inspection. */
export interface ProfileInspectionApp {
  id: string;
  manifestAppId: string;
  displayName: string;
  packageRefs: string[];
  hasSettings: boolean;
}

/** One grouped, profile-owned app-settings row from the inspection. */
export interface ProfileInspectionSettingsApp {
  id: string;
  displayName: string;
  associationStatus: ProfileInspectionAssociationStatus;
  ownerId: string | null;
  appId: string | null;
  appIncluded: boolean;
  packageRefs: string[];
  moduleIds: string[];
  candidateAppIds: string[];
  capturedEntryCount: number;
}

/** Engine-authored profile-inspection warning. */
export interface ProfileInspectionWarning {
  code: string;
  message: string;
  impact: ProfileInspectionWarningImpact;
}

/** Complete successful `profile inspect` payload. */
export interface ProfileInspectionData {
  profile: ProfileInspectionProfile;
  summary: ProfileInspectionSummary;
  apps: ProfileInspectionApp[];
  settingsApps: ProfileInspectionSettingsApp[];
  warnings: ProfileInspectionWarning[];
}

// -----------------------------------------------------------------------------
// Scheduled setup checks
//
// Response shapes for the `endstate schedule *` subcommand family, per the
// engine's cli-json-contract.md "Command: schedule". The GUI renders these
// verbatim — drift truth lives entirely in the engine (CLI is source of truth).
// -----------------------------------------------------------------------------

/** Aggregated verify counts from a scheduled drift-check run. */
export interface ScheduleVerifySummary {
  total: number;
  pass: number;
  fail: number;
}

/** A single drifted item recorded by a scheduled drift-check run. */
export interface ScheduleDriftItem {
  id: string;
  name?: string;
  status: string;
  reason?: string;
}

/** Verify outcome (summary + drifted items) from a scheduled run. */
export interface ScheduleLastRunVerify {
  summary: ScheduleVerifySummary;
  drifted?: ScheduleDriftItem[];
}

/** Outcome of the optional auto-backup step of a scheduled run. */
export interface ScheduleLastRunBackup {
  outcome: 'pushed' | 'skipped' | 'auth_required' | 'subscription_required' | 'setup_required' | 'upload_uncertain' | 'error';
  backupId?: string;
  versionId?: string;
}

/** Engine-owned upload truth for the saved baseline after scheduled checks. */
export interface SchedulePendingUpload {
  pending: boolean;
  /** Number of queued fresh captures; absent engines imply one when pending. */
  count?: number;
  artifactSha256?: string;
  lastOutcome?: 'pushed' | 'skipped' | 'auth_required' | 'subscription_required' | 'setup_required' | 'upload_uncertain' | 'error' | 'offline';
}

/** Hard failure that prevented a scheduled run from completing. */
export interface ScheduleLastRunError {
  code: string;
  message: string;
}

/** Persisted outcome of the most recent scheduled drift-check run. */
export interface ScheduleLastRun {
  schemaVersion: string;
  runId: string;
  timestampUtc: string;
  /** Additive run marker. `running` is written before scheduled work starts;
   * `completed`/`failed` are terminal, and unknown non-empty values fail closed. */
  status?: string;
  verify?: ScheduleLastRunVerify | null;
  autoBackup?: ScheduleLastRunBackup | null;
  error?: ScheduleLastRunError | null;
}

/** Response shape for `endstate schedule status --json`. */
export interface ScheduleStatusData {
  enabled: boolean;
  manifest?: string;
  interval?: string;
  time?: string;
  autoPush: boolean;
  taskName?: string;
  /** Additive pinned backup target for scheduled Cloud uploads. */
  backupId?: string;
  /** Absent on older engines: upload state is then unknown, never healthy. */
  pendingUpload?: SchedulePendingUpload;
  /** Null/absent when the schedule has never run. */
  lastRun?: ScheduleLastRun | null;
}

/** Response shape for `endstate schedule enable --json`. */
export interface ScheduleEnableData {
  enabled: boolean;
  manifest: string;
  interval: string;
  time: string;
  autoPush: boolean;
  taskName: string;
  root: string;
  backupId?: string;
}

/** Response shape for `endstate schedule disable --json`. */
export interface ScheduleDisableData {
  enabled: boolean;
  taskName: string;
}

/**
 * Hosted-backup subscription state per contract §10.
 * - `none`: never subscribed or fully cancelled past retention
 * - `active`: subscription paid, current
 * - `grace`: payment failed, in 30-day grace window (read OK, write blocked)
 * - `cancelled`: user cancelled, in 30-day retention (read OK, write blocked)
 */
export type SubscriptionStatus = 'none' | 'active' | 'grace' | 'cancelled';

/** Response shape for `endstate backup signup --json`. */
export interface BackupSignupData {
  userId: string;
  email: string;
  subscriptionStatus?: SubscriptionStatus;
  /** Absolute path to the temp file the engine wrote the 24-word mnemonic to. */
  recoveryKeySavedTo: string;
}

/** Response shape for `endstate backup login --json`. */
export interface BackupLoginData {
  userId: string;
  email: string;
  subscriptionStatus?: SubscriptionStatus;
}

/** Response shape for `endstate backup logout --json`. */
export interface BackupLogoutData {
  signedOut: boolean;
}

/** Response shape for `endstate backup status --json`. */
export interface BackupStatusData {
  signedIn: boolean;
  email?: string;
  userId?: string;
  subscriptionStatus?: SubscriptionStatus;
  issuerUrl: string;
  /** ISO 8601 timestamp of the most recent successful push, if any. */
  lastBackupAt?: string;
  /** Set when the OS keychain failed; auth still works but session won't persist. */
  keychainError?: string;
  /**
   * Storage usage across all backups for the signed-in user, in bytes.
   * Coordinated separately with the engine — the GUI treats this as optional
   * so the field can ship in any order. Substrate computes the underlying
   * value via `sumActiveStorageForUser`.
   */
  quotaUsedBytes?: number;
  /** Total storage allotment for the user's plan, in bytes. */
  quotaTotalBytes?: number;
  /** Number of versions across all backups for the user. */
  versionCount?: number;
  /**
   * ISO 8601 timestamp marking the end of the 30-day grace window. Set when
   * `subscriptionStatus === 'grace'`; absent otherwise.
   */
  graceEndsAt?: string;
}

/** A single backup row from `endstate backup list --json`. */
export interface BackupListItem {
  id: string;
  name: string;
  latestVersionId?: string;
  versionCount: number;
  totalSize: number;
  /** ISO 8601 timestamp of the latest version. */
  updatedAt: string;
}

/** Response shape for `endstate backup list --json`. */
export interface BackupListData {
  backups: BackupListItem[];
}

/** A single version row from `endstate backup versions --json`. */
export interface BackupVersionItem {
  versionId: string;
  /** ISO 8601 timestamp of version creation. */
  createdAt: string;
  /** Encrypted size in bytes. */
  size: number;
  /** SHA-256 of the encrypted manifest blob, hex-encoded. */
  manifestSha256: string;
}

/** Response shape for `endstate backup versions --json`. */
export interface BackupVersionsData {
  backupId: string;
  versions: BackupVersionItem[];
}

/** Response shape for `endstate backup push --json`. */
export interface BackupPushData {
  backupId: string;
  /** Absent when `--if-changed` skipped the upload (content unchanged). */
  versionId?: string;
  /** True when `--if-changed` found the content unchanged; no new version created. */
  skipped?: boolean;
}

/**
 * Response shape for `endstate backup estimate --json` — the exact bytes a push
 * of the same profile would upload, computed client-side with no network call.
 * Used to warn before a push that would approach/exceed the quota.
 */
export interface BackupEstimateData {
  /** Encrypted chunks + encrypted manifest — the bytes counted against quota. */
  estimatedUploadBytes: number;
  /** Tarred profile size before encryption. */
  plaintextBytes: number;
  chunkCount: number;
}

/** Response shape for `endstate backup pull --json`. */
export interface BackupPullData {
  backupId: string;
  versionId: string;
  /** Absolute path the profile was restored to. */
  writtenTo: string;
}

/** Response shape for `endstate backup delete --json`. */
export interface BackupDeleteData {
  backupId: string;
  deleted: boolean;
}

/** Response shape for `endstate backup rename --json`. The id is unchanged
 *  identity; `name` is the new label echoed by the backend. */
export interface BackupRenameData {
  backupId: string;
  name: string;
  updatedAt?: string;
}

/** Response shape for `endstate backup delete-version --json`. */
export interface BackupDeleteVersionData {
  backupId: string;
  versionId: string;
  deleted: boolean;
}

/** Response shape for `endstate backup recover --json`. */
export interface BackupRecoverData {
  userId: string;
  email: string;
}

/** Response shape for `endstate account delete --json`. */
export interface AccountDeleteData {
  deleted: boolean;
}

/**
 * Response shape for `endstate backup subscribe --json`.
 *
 * The engine calls substrate's checkout endpoint with the user's session and
 * returns a checkout-transaction URL. The GUI opens `checkoutUrl` in the
 * system browser; substrate's `/endstate` landing renders the payment overlay
 * from the URL params. The GUI never renders checkout itself (see
 * hosted-backup contract §7). Payment provider lives substrate-side and is
 * not surfaced in this contract.
 */
export interface BackupSubscribeData {
  /** Checkout-transaction URL, e.g. `https://…/endstate?_ptxn=<txn>`. */
  checkoutUrl: string;
  /** Transaction id minted for this checkout. */
  transactionId: string;
}

/**
 * Response shape for `endstate backup browser-session --json`.
 *
 * Returned by the engine after POSTing to substrate's `/api/auth/browser-session`
 * with the user's session. The GUI composes `${accountUrl}?session=${sessionToken}`
 * and opens it in the system browser; substrate's `/account/start` route swaps
 * the 60s JWT for an HttpOnly cookie and redirects to the cookie-only `/account`
 * page (hosted-backup contract §5).
 */
export interface BackupBrowserSessionData {
  /** 60s EdDSA JWT, aud=endstate-account. Single-use. */
  sessionToken: string;
  /** Substrate-advertised portal landing, e.g. `https://…/account/start`. */
  accountUrl: string;
}

export interface VerifyItem {
  id: string;
  driver: string;
  status: 'ok' | 'missing' | 'version_mismatch';
  version?: string;
  reason?: string;
  constraint?: string;
}

export interface EndstateVerifyData {
  manifestPath?: string;
  okCount?: number;
  missingCount?: number;
  versionMismatches?: number;
  extraCount?: number;
  missingApps?: string[];
  versionMismatchApps?: Array<{
    id: string;
    reason: string;
    installedVersion: string;
    constraint: string;
  }>;
  items?: VerifyItem[];
  warnings?: CommandWarning[];
}

export interface EndstateReportData {
  hasState?: boolean;
  lastApplied?: {
    timestamp: string;
    manifestPath: string;
    runId?: string;
  };
  lastVerify?: {
    timestamp: string;
    missingCount?: number;
    runId?: string;
  };
  reports?: Array<{
    runId: string;
    timestamp: string;
    command: string;
    dryRun?: boolean;
    manifest?: {
      name: string;
      path: string;
      hash: string;
    };
    summary?: {
      success?: number;
      skipped?: number;
      failed?: number;
    };
    stateFile?: string;
  }>;
}

export interface EndstateApplyData {
  dryRun?: boolean;
  manifest?: {
    path: string;
    name: string;
    hash: string;
  };
  /**
   * Aggregate result counts — the apply envelope's aggregate field, not a
   * legacy one. It was previously annotated as superseded by `counts`, a field
   * the apply envelope has never carried (`counts` belongs to `capture`), which
   * is how the GUI came to read a field that is always absent.
   */
  summary?: {
    total?: number;
    success?: number;
    skipped?: number;
    failed?: number;
  };
  /**
   * Per-app results, and the authoritative final state for reconciliation.
   * There is no `items` field on an apply envelope — that belongs to
   * `generations`. See docs/contracts/cli-json-contract.md, "Apply result
   * fields: summary and actions".
   */
  actions?: ApplyAction[];
  runId?: string;
  stateFile?: string;
  logFile?: string;
  eventsFile?: string;
  configModuleMap?: Record<string, string>;
  /** Restore summary when --enable-restore is active. */
  restoreSummary?: RestoreSummary;
  restoreItems?: RestoreResult[];
  restoreJournalFile?: string;
  restoreFilter?: string[];
  restoreModulesAvailable?: RestoreModuleRef[];
  /** Generation-aware configuration results; omitted for config-free input. */
  configResolutions?: ConfigResolution[];
  /** Engine-owned counts for configResolutions; omitted for config-free input. */
  configResolutionSummary?: ConfigResolutionSummary;
  warnings?: CommandWarning[];
}

/** Enriched module reference from engine (v1.5+), or plain string ID from older CLIs. */
export interface RestoreModuleRef {
  id: string;
  displayName: string;
  /**
   * How many of the profile's restore entries resolve to this module. Always
   * > 0 — the engine omits modules it would restore nothing for.
   *
   * Optional because engines predating the profile-scoping change do not emit
   * it. Those engines also do not scope the list, so a consumer seeing entries
   * without `entryCount` is looking at every catalog module matching the app
   * list rather than what the profile carries.
   */
  entryCount?: number;
}

export interface CapturedApp {
  id: string;
  source?: string;
  /** Friendly display name from engine (e.g., "Visual Studio Code") */
  name?: string;
}

export interface CaptureWarning {
  code: string;
  message: string;
  driver?: string;
  source?: string;
  ref?: string;
}

export interface CaptureCounts {
  totalFound: number;
  included: number;
  skipped: number;
  filteredRuntimes: number;
  filteredStoreApps: number;
  sensitiveExcludedCount: number;
}

export interface EndstateCaptureData {
  outputPath?: string;
  sanitized?: boolean;
  isExample?: boolean;
  counts?: CaptureCounts;
  appsIncluded?: CapturedApp[];
  /** Warning codes from capture (e.g., WINGET_EXPORT_FAILED_FALLBACK_USED) */
  captureWarnings?: string[];
  /** Structured non-fatal source and portability warnings from the engine. */
  warnings?: CaptureWarning[];
  /** Output format: 'jsonc' (manifest only) or 'zip' (bundle with configs) */
  outputFormat?: 'jsonc' | 'zip';
  /** Config module IDs successfully captured into the bundle */
  configsIncluded?: string[];
  /** Config module IDs skipped (no files found) */
  configsSkipped?: string[];
  /** Config module IDs with capture errors */
  configsCaptureErrors?: string[];
  /** Structured config module metadata (engine-provided appId associations) */
  configModules?: CaptureConfigModule[];
}

/** Manual app metadata from the engine for apps that can't be auto-installed. */
export interface ManualAppInfo {
  verifyPath: string;
  launch?: string;
  instructions?: string;
  fallback?: string;
}

export interface ApplyItem {
  id: string;
  driver: string;
  status: 'ok' | 'skipped' | 'failed';
  reason?: string;
  message?: string;
  /** Present when driver is "manual" and the app is not installed. */
  manual?: ManualAppInfo | null;
  /** Display name from engine (e.g., "Visual Studio Code"). */
  name?: string;
}

/**
 * One per-app result from the apply envelope's `actions[]`.
 *
 * Shape mirrors the engine's ApplyAction (see the engine repo's
 * docs/contracts/cli-json-contract.md). `status` is the terminal state:
 * `to_install` appears only on a dry run and is never final on a real apply.
 */
export interface ApplyAction {
  id: string;
  ref?: string | null;
  driver?: string;
  source?: string;
  /** Engine-supplied display name. Absent until the engine resolves the package. */
  name?: string;
  status: 'to_install' | 'installed' | 'present' | 'failed' | string;
  reason?: string;
  message?: string;
  version?: string;
  manual?: ManualAppInfo | null;
}

export interface ApplyCounts {
  total: number;
  installed: number;
  alreadyInstalled: number;
  skippedFiltered: number;
  failed: number;
}

/**
 * @deprecated Use EndstateApplyData instead — the engine returns a single shape.
 * Kept for backward compatibility with existing tests.
 */
export type EndstateApplyResultData = EndstateApplyData;

/** Final result for one restore action in a completed command envelope. */
export interface RestoreResult {
  id: string;
  source: string;
  target: string;
  status: RestoreResultStatus;
  backupPath?: string;
  backupCreated: boolean;
  targetExistedBefore: boolean;
  error?: string;
  warnings?: string[];
  restoreType?: string;
  captureId?: string;
  configSetId?: string;
  targetInstanceId?: string;
  sourceGeneration?: string;
  targetGeneration?: string;
}

export type RestoreResultStatus =
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

/** Restore summary from JSON envelope */
export interface RestoreSummary {
  total: number;
  restored: number;
  skipped: number;
  failed: number;
  backupLocation: string | null;
}

/** Individual result item from revert command */
export interface RevertResultItem {
  id: string;
  targetPath: string;
  type: string;
  status: string; // 'skip' | 'dry-run' | 'reverted' | 'failed'
  reason: string | null;
}

/** Revert command data from CLI envelope */
export interface EndstateRevertData {
  dryRun: boolean;
  revertedRestoreRunId: string | null;
  revertCount: number;
  skipCount: number;
  failCount: number;
  backupLocation: string | null;
  results: RevertResultItem[];
}

/** Config module metadata from capture envelope */
export interface ConfigModuleInfo {
  id: string;
  displayName: string;
  entries: number;
  files: string[];
}

/** Structured config module metadata from capture envelope (when --WithConfig used) */
export interface CaptureConfigModule {
  id: string;
  appId: string;
  displayName: string;
  status: 'captured' | 'skipped' | 'error';
  filesCaptured: number;
  /** Winget package IDs for exact matching against app events (e.g., ["Microsoft.VisualStudioCode"]) */
  wingetRefs?: string[];
  /** Collected config paths reported by the engine. */
  paths?: string[];
  /** Non-fatal module-level capture warnings authored by the engine. */
  warnings?: string[];
  /** Module-level capture errors authored by the engine. */
  errors?: string[];
}

/** Restore intent — controls --EnableRestore flag */
export type RestoreIntent = 'apps-only' | 'apps-and-settings';

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

export interface EndstateHostedBackupCapability {
  supported: boolean;
  minSchemaVersion?: string;
  issuerUrl?: string;
  audience?: string;
}

export interface EndstateCapabilitiesData {
  supportedSchemaVersions?: {
    min: string;
    max: string;
  };
  commands?: string[];
  features?: {
    streaming?: boolean;
    parallelInstall?: boolean;
    configModules?: boolean;
    jsonOutput?: boolean;
    manualApps?: boolean;
    hostedBackup?: EndstateHostedBackupCapability;
  };
  platform?: {
    os: string;
    drivers: string[];
  };
  gitCommit?: string | null;
  gitDirty?: boolean;
  bootstrapTimestamp?: string | null;
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
  versionId: string;
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
  /** Legacy aggregate summary — use `counts` instead when available. */
  summary?: {
    total?: number;
    success?: number;
    skipped?: number;
    failed?: number;
  };
  /** Structured app-only counts from the engine envelope. */
  counts?: ApplyCounts;
  /** Per-app result items for final-state reconciliation. */
  items?: ApplyItem[];
  actions?: Array<{
    type: string;
    id?: string;
    ref?: string | null;
    status: string;
    message: string;
  }>;
  runId?: string;
  stateFile?: string;
  logFile?: string;
  eventsFile?: string;
  configModuleMap?: Record<string, string>;
  /** Restore summary when --enable-restore is active. */
  restoreSummary?: RestoreSummary;
  restoreItems?: RestoreItem[];
  restoreJournalFile?: string;
  restoreFilter?: string[];
  restoreModulesAvailable?: RestoreModuleRef[];
}

/** Enriched module reference from engine (v1.5+), or plain string ID from older CLIs. */
export interface RestoreModuleRef {
  id: string;
  displayName: string;
}

export interface CapturedApp {
  id: string;
  source?: string;
  /** Friendly display name from engine (e.g., "Visual Studio Code") */
  name?: string;
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

/** Restore item from NDJSON events and JSON envelope */
export interface RestoreItem {
  id: string;
  module: string;
  restorer: 'copy' | 'merge-json' | 'merge-ini' | 'append';
  source: string;
  target: string;
  status: RestoreItemStatus;
  reason: string | null;
  backupPath: string | null;
  targetExisted: boolean;
  message: string | null;
}

export type RestoreItemStatus =
  | 'restoring'
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
}

/** Restore intent — controls --EnableRestore flag */
export type RestoreIntent = 'apps-only' | 'apps-and-settings';

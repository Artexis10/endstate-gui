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
  };
  platform?: {
    os: string;
    drivers: string[];
  };
  gitCommit?: string | null;
  gitDirty?: boolean;
  bootstrapTimestamp?: string | null;
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
  summary?: {
    total?: number;
    success?: number;
    skipped?: number;
    failed?: number;
  };
  actions?: Array<{
    type: string;
    id?: string;
    ref?: string;
    status: string;
    message: string;
  }>;
  runId?: string;
  stateFile?: string;
  logFile?: string;
  eventsFile?: string;
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

export interface ApplyItem {
  id: string;
  driver: string;
  status: 'ok' | 'skipped' | 'failed';
  reason?: string;
  message?: string;
}

export interface ApplyCounts {
  total: number;
  installed: number;
  alreadyInstalled: number;
  skippedFiltered: number;
  failed: number;
}

export interface EndstateApplyResultData {
  manifestPath?: string;
  installed?: number;
  upgraded?: number;
  skipped?: number;
  failed?: number;
  dryRun?: boolean;
  counts?: ApplyCounts;
  items?: ApplyItem[];
  restoreItems?: RestoreItem[];
  restoreSummary?: RestoreSummary;
  restoreJournalFile?: string;
  restoreFilter?: string[];
  restoreModulesAvailable?: string[];
  /** Maps winget ID → config module name for apps that have settings in the profile */
  configModuleMap?: Record<string, string>;
}

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

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
}

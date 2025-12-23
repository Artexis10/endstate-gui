export interface AutosuiteEnvelope<T = unknown> {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
  timestampUtc: string;
  success: boolean;
  data: T;
  error: AutosuiteError | null;
}

export interface AutosuiteError {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  remediation?: string;
  docsKey?: string;
}

export interface AutosuiteCapabilitiesData {
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

export interface AutosuiteVerifyData {
  manifest?: {
    path: string;
    name: string;
  };
  summary?: {
    total?: number;
    okCount?: number;
    missingCount?: number;
    versionMismatchCount?: number;
    pass?: number;
    fail?: number;
  };
  results?: Array<{
    type: string;
    status: string;
    verifyType?: string;
    id?: string;
    ref?: string;
    path?: string;
    command?: string;
    message?: string;
  }>;
  stateFile?: string;
}

export interface AutosuiteReportData {
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

export interface AutosuiteApplyData {
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
  stateFile?: string;
  logFile?: string;
}

export interface CapturedApp {
  id: string;
  wingetId?: string;
  source?: string;
}

export interface AutosuiteCaptureData {
  outputPath?: string;
  sanitized?: boolean;
  isExample?: boolean;
  appCount?: number;
  appsCaptured?: CapturedApp[];
}

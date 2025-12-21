/**
 * Autosuite CLI Bridge
 * 
 * This module provides the platform-agnostic interface between Autosuite GUI
 * and the Autosuite CLI. All CLI interactions go through this bridge to ensure
 * proper versioning and compatibility checks.
 * 
 * Execution Model:
 * - Development: CLI resolved from PATH, executed via Node.js child_process
 * - Production: Bundled CLI binary, executed via Tauri/Rust Command API
 * 
 * This module defines types and validation only. Platform-specific execution
 * must be implemented by the runtime layer.
 * 
 * @see docs/cli-json-contract.md in the autosuite repository for the full contract.
 * @see .windsurf/rules/project-ruleset.md for authoritative contract rules.
 */

// Schema version this GUI is compatible with
const REQUIRED_SCHEMA_VERSION = '1.0';
const MIN_SCHEMA_VERSION = '1.0';
const MAX_SCHEMA_VERSION = '1.0';

/**
 * Standard JSON envelope returned by all Autosuite CLI commands with --json flag.
 */
export interface CliEnvelope<T = unknown> {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
  timestampUtc: string;
  success: boolean;
  data: T;
  error: CliError | null;
}

/**
 * Standardized error object used across all CLI commands.
 */
export interface CliError {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  remediation?: string;
  docsKey?: string;
}

/**
 * Capabilities data returned by `autosuite capabilities --json`.
 */
export interface CapabilitiesData {
  supportedSchemaVersions: {
    min: string;
    max: string;
  };
  commands: Record<string, {
    supported: boolean;
    flags: string[];
  }>;
  features: {
    streaming: boolean;
    parallelInstall: boolean;
    configModules: boolean;
    jsonOutput: boolean;
  };
  platform: {
    os: string;
    drivers: string[];
  };
}

/**
 * Apply command result data.
 */
export interface ApplyData {
  dryRun: boolean;
  manifest: {
    path: string;
    name: string;
    hash: string;
  };
  summary: {
    total: number;
    success: number;
    skipped: number;
    failed: number;
  };
  actions: Array<{
    type: string;
    id?: string;
    ref?: string;
    status: string;
    message: string;
  }>;
  stateFile: string;
  logFile: string;
}

/**
 * Verify command result data.
 */
export interface VerifyData {
  manifest: {
    path: string;
    name: string;
  };
  summary: {
    total: number;
    pass: number;
    fail: number;
  };
  results: Array<{
    type: string;
    status: string;
    verifyType?: string;
    id?: string;
    ref?: string;
    path?: string;
    command?: string;
    message?: string;
  }>;
  stateFile: string;
}

/**
 * Report command result data.
 */
export interface ReportData {
  reports: Array<{
    runId: string;
    timestamp: string;
    command: string;
    dryRun: boolean;
    manifest: {
      name: string;
      path: string;
      hash: string;
    };
    summary: {
      success: number;
      skipped: number;
      failed: number;
    };
    stateFile: string;
  }>;
}

/**
 * Error thrown when CLI schema version is incompatible.
 */
export class SchemaIncompatibleError extends Error {
  constructor(
    public readonly cliVersion: string,
    public readonly cliSchemaVersion: string,
    public readonly requiredSchemaVersion: string
  ) {
    super(
      `Autosuite CLI (v${cliVersion}, schema ${cliSchemaVersion}) is not compatible ` +
      `with this version of Autosuite GUI (requires schema ${requiredSchemaVersion}).`
    );
    this.name = 'SchemaIncompatibleError';
  }
}

/**
 * Error thrown when CLI is not found or not accessible.
 */
export class CliNotFoundError extends Error {
  constructor(public readonly searchPath: string) {
    super(
      `Autosuite CLI not found. Searched in: ${searchPath}. ` +
      `Please ensure Autosuite is installed and available on PATH.`
    );
    this.name = 'CliNotFoundError';
  }
}

/**
 * Error thrown when CLI command fails.
 */
export class CliCommandError extends Error {
  constructor(
    public readonly command: string,
    public readonly cliError: CliError
  ) {
    super(`CLI command '${command}' failed: ${cliError.message}`);
    this.name = 'CliCommandError';
  }
}

/**
 * Compares two semver-like version strings.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Checks if a schema version is compatible with the GUI's requirements.
 */
export function isSchemaCompatible(schemaVersion: string): boolean {
  const minCompare = compareVersions(schemaVersion, MIN_SCHEMA_VERSION);
  const maxCompare = compareVersions(schemaVersion, MAX_SCHEMA_VERSION);
  
  return minCompare >= 0 && maxCompare <= 0;
}

/**
 * Validates a CLI response envelope and throws if incompatible.
 */
export function validateEnvelope<T>(envelope: CliEnvelope<T>): void {
  if (!envelope.schemaVersion) {
    throw new Error('Invalid CLI response: missing schemaVersion');
  }
  
  if (!isSchemaCompatible(envelope.schemaVersion)) {
    throw new SchemaIncompatibleError(
      envelope.cliVersion,
      envelope.schemaVersion,
      REQUIRED_SCHEMA_VERSION
    );
  }
}

/**
 * Parses CLI JSON output and validates the envelope.
 */
export function parseCliOutput<T>(jsonOutput: string): CliEnvelope<T> {
  const envelope = JSON.parse(jsonOutput) as CliEnvelope<T>;
  validateEnvelope(envelope);
  return envelope;
}

/**
 * CLI Bridge class for interacting with Autosuite CLI.
 * 
 * Usage:
 * ```typescript
 * const bridge = new CliBridge();
 * await bridge.initialize(); // Validates CLI compatibility
 * const result = await bridge.apply(manifestPath, { dryRun: true });
 * ```
 */
export class CliBridge {
  private _cliPath: string = 'autosuite'; // Default: resolve from PATH
  private capabilities: CapabilitiesData | null = null;
  private cliVersion: string | null = null;
  private schemaVersion: string | null = null;
  
  constructor(cliPath?: string) {
    if (cliPath) {
      this._cliPath = cliPath;
    }
  }
  
  /**
   * Get the CLI path.
   */
  getCliPath(): string {
    return this._cliPath;
  }
  
  /**
   * Initialize the bridge by checking CLI availability and compatibility.
   * Must be called before any other operations.
   * 
   * @throws {CliNotFoundError} If CLI is not found
   * @throws {SchemaIncompatibleError} If CLI schema version is incompatible
   */
  async initialize(): Promise<void> {
    const result = await this.executeCommand<CapabilitiesData>('capabilities');
    
    this.capabilities = result.data;
    this.cliVersion = result.cliVersion;
    this.schemaVersion = result.schemaVersion;
  }
  
  /**
   * Get the CLI version after initialization.
   */
  getCliVersion(): string | null {
    return this.cliVersion;
  }
  
  /**
   * Get the schema version after initialization.
   */
  getSchemaVersion(): string | null {
    return this.schemaVersion;
  }
  
  /**
   * Get capabilities after initialization.
   */
  getCapabilities(): CapabilitiesData | null {
    return this.capabilities;
  }
  
  /**
   * Check if a specific command is supported.
   */
  isCommandSupported(command: string): boolean {
    if (!this.capabilities) return false;
    return this.capabilities.commands[command]?.supported ?? false;
  }
  
  /**
   * Execute a CLI command and return the parsed envelope.
   * 
   * This method must be implemented by the platform-specific layer:
   * - Development (Node.js): Use child_process.spawn
   * - Production (Tauri): Use Tauri Command API via Rust backend
   * 
   * @throws {CliNotFoundError} If CLI is not found
   * @throws {SchemaIncompatibleError} If CLI schema version is incompatible
   * @throws {CliCommandError} If the command fails
   */
  async executeCommand<T>(
    _command: string,
    _args: string[] = []
  ): Promise<CliEnvelope<T>> {
    // Platform-specific implementation required.
    // Development: Node.js child_process
    // Production: Tauri/Rust Command API
    throw new Error(
      'executeCommand must be implemented by the platform-specific layer.'
    );
  }
  
  /**
   * Run the apply command.
   */
  async apply(
    manifestPath: string,
    options: { dryRun?: boolean; enableRestore?: boolean } = {}
  ): Promise<CliEnvelope<ApplyData>> {
    const args = ['--manifest', manifestPath, '--json'];
    if (options.dryRun) args.push('--dry-run');
    if (options.enableRestore) args.push('--enable-restore');
    
    return this.executeCommand<ApplyData>('apply', args);
  }
  
  /**
   * Run the verify command.
   */
  async verify(manifestPath: string): Promise<CliEnvelope<VerifyData>> {
    return this.executeCommand<VerifyData>('verify', [
      '--manifest', manifestPath,
      '--json'
    ]);
  }
  
  /**
   * Run the report command.
   */
  async report(
    options: { runId?: string; latest?: boolean; last?: number } = {}
  ): Promise<CliEnvelope<ReportData>> {
    const args = ['--json'];
    if (options.runId) args.push('--run-id', options.runId);
    else if (options.last) args.push('--last', options.last.toString());
    else args.push('--latest');
    
    return this.executeCommand<ReportData>('report', args);
  }
}

/**
 * Display-friendly error message for schema incompatibility.
 * Use this to show users a clear error when versions don't match.
 */
export function formatIncompatibilityError(error: SchemaIncompatibleError): string {
  return `
Autosuite CLI Incompatible

The installed Autosuite CLI (v${error.cliVersion}, schema ${error.cliSchemaVersion}) 
is not compatible with this version of Autosuite GUI (requires schema ${error.requiredSchemaVersion}).

Please update Autosuite CLI or use a compatible GUI version.
`.trim();
}

// Export version constants for external use
export const CLI_SCHEMA = {
  REQUIRED: REQUIRED_SCHEMA_VERSION,
  MIN: MIN_SCHEMA_VERSION,
  MAX: MAX_SCHEMA_VERSION,
};

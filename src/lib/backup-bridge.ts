/**
 * Hosted-backup CLI bridge.
 *
 * Typed wrappers for `endstate backup *` and `endstate account *` subcommands.
 * Each wrapper invokes the engine via the existing `runEndstateOnce`
 * (single-envelope) or `runEndstateStreaming` (push/pull) helpers and returns
 * a typed envelope or `BackupCommandError` on failure.
 *
 * GUI components call these directly. The GUI never hits substrate or wraps
 * crypto — all of that lives in the engine per the hosted-backup contract
 * (see ../endstate/docs/contracts/hosted-backup-contract.md, locked v2.0).
 *
 * Passphrase / mnemonic handling: secrets are passed via stdin (not flags or
 * env). The engine reads them line-by-line and never echoes them back. Callers
 * pass plaintext; the bridge does not log or persist it.
 */

import { runEndstateOnce } from './engine-exec';
import { runEndstateStreaming, NdjsonEventCallback } from '../streaming-runner';
import { AppSettings } from '../settings';
import {
  EndstateEnvelope,
  BackupSignupData,
  BackupLoginData,
  BackupLogoutData,
  BackupStatusData,
  BackupListData,
  BackupVersionsData,
  BackupPushData,
  BackupPullData,
  BackupDeleteData,
  BackupDeleteVersionData,
  BackupRecoverData,
  BackupSubscribeData,
  BackupBrowserSessionData,
  AccountDeleteData,
} from '../types';

/**
 * Structured error from a hosted-backup command.
 *
 * Wraps the engine's `error` envelope so callers receive `code` + `message` +
 * `remediation` rather than untyped strings. Components surface `message` to
 * the user and may show `remediation` as a hint.
 */
export class BackupCommandError extends Error {
  readonly code: string;
  readonly remediation?: string;
  readonly docsKey?: string;
  readonly detail?: Record<string, unknown>;

  constructor(args: {
    code: string;
    message: string;
    remediation?: string;
    docsKey?: string;
    detail?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = 'BackupCommandError';
    this.code = args.code;
    this.remediation = args.remediation;
    this.docsKey = args.docsKey;
    this.detail = args.detail;
  }
}

/** Run a one-shot `backup`/`account` subcommand and return typed `data`. */
async function runBackupOnce<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  stdinInput?: string,
): Promise<T> {
  const result = await runEndstateOnce<EndstateEnvelope<T>>(
    settings,
    command,
    args,
    stdinInput,
  );

  if (!result.success) {
    // Try to surface the engine's error envelope if the JSON parsed; otherwise
    // wrap the runtime failure (CLI not found, no output, etc.).
    const envelope = result.envelope as EndstateEnvelope<T> | undefined;
    if (envelope?.error) {
      throw new BackupCommandError({
        code: envelope.error.code,
        message: envelope.error.message,
        remediation: envelope.error.remediation,
        docsKey: envelope.error.docsKey,
        detail: envelope.error.detail,
      });
    }
    throw new BackupCommandError({
      code: result.error.kind.toUpperCase(),
      message: result.error.message,
      detail: result.error.stderr ? { stderr: result.error.stderr } : undefined,
    });
  }

  if (!result.envelope.success) {
    const err = result.envelope.error;
    throw new BackupCommandError({
      code: err?.code ?? 'UNKNOWN_ERROR',
      message: err?.message ?? 'Command failed without an error message.',
      remediation: err?.remediation,
      docsKey: err?.docsKey,
      detail: err?.detail,
    });
  }

  return result.envelope.data;
}

// -----------------------------------------------------------------------------
// Auth commands (stdin-fed secrets)
// -----------------------------------------------------------------------------

export interface SignupArgs {
  email: string;
  passphrase: string;
  /** Absolute path the engine will write the 24-word mnemonic to. */
  saveRecoveryTo: string;
}

/**
 * Create a new hosted-backup account.
 *
 * The engine generates the 24-word recovery mnemonic, writes it to
 * `saveRecoveryTo`, and returns `recoveryKeySavedTo` (echoes the same path).
 * The GUI must read that file, present the mnemonic in the recovery-key
 * dialog, then delete the file once the user has saved it via the required
 * two save methods (see `recovery-key-dialog.tsx`).
 */
export async function backupSignup(
  settings: AppSettings,
  args: SignupArgs,
): Promise<BackupSignupData> {
  return runBackupOnce<BackupSignupData>(
    settings,
    'backup',
    ['signup', '--email', args.email, '--save-recovery-to', args.saveRecoveryTo],
    `${args.passphrase}\n`,
  );
}

export interface ClaimArgs {
  /** 43-char URL-safe base64 token from the buyer's claim email. */
  token: string;
  passphrase: string;
  /** Absolute path the engine will write the 24-word mnemonic to. */
  saveRecoveryTo: string;
}

/**
 * Attach credentials to a Hosted Backup pre-account using a claim token.
 *
 * Mirrors `backupSignup`, except the engine reads the email from substrate's
 * `claim_tokens` row (keyed by the bearer token) instead of taking it as a
 * flag. The returned envelope's `email` is server-supplied; the GUI MUST NOT
 * present any user-entered email as authoritative on this path.
 */
export async function backupClaim(
  settings: AppSettings,
  args: ClaimArgs,
): Promise<BackupSignupData> {
  return runBackupOnce<BackupSignupData>(
    settings,
    'backup',
    ['claim', '--token', args.token, '--save-recovery-to', args.saveRecoveryTo],
    `${args.passphrase}\n`,
  );
}

export interface LoginArgs {
  email: string;
  passphrase: string;
}

/** Sign in to an existing hosted-backup account. */
export async function backupLogin(
  settings: AppSettings,
  args: LoginArgs,
): Promise<BackupLoginData> {
  return runBackupOnce<BackupLoginData>(
    settings,
    'backup',
    ['login', '--email', args.email],
    `${args.passphrase}\n`,
  );
}

/** Clear the local hosted-backup session. */
export async function backupLogout(settings: AppSettings): Promise<BackupLogoutData> {
  return runBackupOnce<BackupLogoutData>(settings, 'backup', ['logout']);
}

/** Report the current hosted-backup session state. */
export async function backupStatus(settings: AppSettings): Promise<BackupStatusData> {
  return runBackupOnce<BackupStatusData>(settings, 'backup', ['status']);
}

/**
 * Begin a Hosted Backup subscription checkout.
 *
 * Requires an active session — the engine calls substrate's checkout endpoint
 * with the persisted access token and returns `{ checkoutUrl, transactionId }`.
 * The GUI opens `checkoutUrl` in the system browser; it never renders checkout
 * itself (hosted-backup contract §7). Signed out → `AUTH_REQUIRED`.
 */
export async function backupSubscribe(
  settings: AppSettings,
): Promise<BackupSubscribeData> {
  return runBackupOnce<BackupSubscribeData>(settings, 'backup', ['subscribe']);
}

/**
 * Mint a short-lived Account Portal handoff token.
 *
 * Returns `{ sessionToken, accountUrl }`; the GUI composes
 * `${accountUrl}?session=${sessionToken}` and opens it in the system browser.
 * Signed out → `AUTH_REQUIRED`. See hosted-backup contract §5.
 */
export async function backupBrowserSession(
  settings: AppSettings,
): Promise<BackupBrowserSessionData> {
  return runBackupOnce<BackupBrowserSessionData>(settings, 'backup', ['browser-session']);
}

export interface RecoverArgs {
  email: string;
  /** 24-word BIP39 recovery mnemonic, whitespace-separated. */
  mnemonic: string;
  newPassphrase: string;
}

/**
 * Reset a forgotten passphrase using the recovery mnemonic.
 *
 * Stdin protocol: line 1 is the mnemonic, line 2 is the new passphrase.
 * The engine validates the mnemonic against the BIP39 wordlist and recovery
 * proof on substrate before accepting the new passphrase.
 */
export async function backupRecover(
  settings: AppSettings,
  args: RecoverArgs,
): Promise<BackupRecoverData> {
  const stdin = `${args.mnemonic}\n${args.newPassphrase}\n`;
  return runBackupOnce<BackupRecoverData>(
    settings,
    'backup',
    ['recover', '--email', args.email],
    stdin,
  );
}

// -----------------------------------------------------------------------------
// Backup metadata commands
// -----------------------------------------------------------------------------

/** List the user's backups. Requires an active session. */
export async function backupList(settings: AppSettings): Promise<BackupListData> {
  return runBackupOnce<BackupListData>(settings, 'backup', ['list']);
}

/** List versions for a specific backup. */
export async function backupVersions(
  settings: AppSettings,
  backupId: string,
): Promise<BackupVersionsData> {
  return runBackupOnce<BackupVersionsData>(
    settings,
    'backup',
    ['versions', '--backup-id', backupId],
  );
}

export interface DeleteBackupArgs {
  backupId: string;
}

/**
 * Permanently delete a backup and all its versions.
 *
 * The wrapper auto-passes `--confirm`; callers must surface their own
 * confirmation modal before invoking. Per contract §10, delete is allowed in
 * any non-`none` subscription state (kindness exception).
 */
export async function backupDelete(
  settings: AppSettings,
  args: DeleteBackupArgs,
): Promise<BackupDeleteData> {
  return runBackupOnce<BackupDeleteData>(
    settings,
    'backup',
    ['delete', '--backup-id', args.backupId, '--confirm'],
  );
}

export interface DeleteVersionArgs {
  backupId: string;
  versionId: string;
}

/** Soft-delete a single backup version (purged after 7 days). */
export async function backupDeleteVersion(
  settings: AppSettings,
  args: DeleteVersionArgs,
): Promise<BackupDeleteVersionData> {
  return runBackupOnce<BackupDeleteVersionData>(
    settings,
    'backup',
    [
      'delete-version',
      '--backup-id',
      args.backupId,
      '--version-id',
      args.versionId,
      '--confirm',
    ],
  );
}

// -----------------------------------------------------------------------------
// Push / pull (streaming)
// -----------------------------------------------------------------------------

export interface PushArgs {
  /** Absolute path to the profile JSON file to encrypt and upload. */
  profile: string;
  /** Existing backup id to append a new version to. Omit to use the first
   *  backup or auto-create one named `name` (default "default"). */
  backupId?: string;
  /** Display name for an auto-created backup. Ignored when `backupId` is set. */
  name?: string;
  /**
   * Pass `--if-changed` so the engine no-ops when the candidate manifest equals
   * the latest version's hash. A skipped result returns `{ skipped: true }` with
   * no `versionId` and is treated as success. Used by automatic backup.
   */
  ifChanged?: boolean;
  /** Callback for chunk-progress events (`backup-chunk`). */
  onEvent?: NdjsonEventCallback;
}

/**
 * Encrypt and upload a profile.
 *
 * Streams `backup-chunk` events with statuses `uploading` / `uploaded` per
 * chunk, plus the standard `phase` and terminal envelope events.
 */
export async function backupPush(
  settings: AppSettings,
  args: PushArgs,
): Promise<BackupPushData> {
  const cliArgs: string[] = ['push', '--profile', args.profile];
  if (args.backupId) cliArgs.push('--backup-id', args.backupId);
  if (args.name) cliArgs.push('--name', args.name);
  if (args.ifChanged) cliArgs.push('--if-changed');

  const result = await runEndstateStreaming<BackupPushData>(
    settings,
    'backup',
    cliArgs,
    () => {
      // Tauri stdout/stderr passthrough — ignored; envelope arrives on stdout.
    },
    {
      enableNdjsonEvents: true,
      onNdjsonEvent: args.onEvent,
    },
  );

  if (!result.envelope || !result.envelope.success) {
    const err = result.envelope?.error;
    throw new BackupCommandError({
      code: err?.code ?? 'PUSH_FAILED',
      message: err?.message ?? `backup push exited with code ${result.exitCode}`,
      remediation: err?.remediation,
      docsKey: err?.docsKey,
      detail: err?.detail,
    });
  }

  return result.envelope.data;
}

export interface PullArgs {
  backupId: string;
  /** Absolute destination path for the restored profile. */
  to: string;
  /** Specific version. Omit to pull the latest. */
  versionId?: string;
  /** Allow overwriting an existing destination. */
  overwrite?: boolean;
  /** Callback for chunk-progress events (`backup-chunk`). */
  onEvent?: NdjsonEventCallback;
}

/**
 * Download and decrypt a backup version.
 *
 * Streams `backup-chunk` events with statuses
 * `downloading` -> `verified` -> `decrypted` per chunk.
 */
export async function backupPull(
  settings: AppSettings,
  args: PullArgs,
): Promise<BackupPullData> {
  const cliArgs: string[] = ['pull', '--backup-id', args.backupId, '--to', args.to];
  if (args.versionId) cliArgs.push('--version-id', args.versionId);
  if (args.overwrite) cliArgs.push('--overwrite');

  const result = await runEndstateStreaming<BackupPullData>(
    settings,
    'backup',
    cliArgs,
    () => {
      // Tauri stdout/stderr passthrough — ignored; envelope arrives on stdout.
    },
    {
      enableNdjsonEvents: true,
      onNdjsonEvent: args.onEvent,
    },
  );

  if (!result.envelope || !result.envelope.success) {
    const err = result.envelope?.error;
    throw new BackupCommandError({
      code: err?.code ?? 'PULL_FAILED',
      message: err?.message ?? `backup pull exited with code ${result.exitCode}`,
      remediation: err?.remediation,
      docsKey: err?.docsKey,
      detail: err?.detail,
    });
  }

  return result.envelope.data;
}

// -----------------------------------------------------------------------------
// Account commands
// -----------------------------------------------------------------------------

/**
 * Hard-delete the user's account and all backed-up data.
 *
 * The wrapper auto-passes `--confirm`. Callers MUST gate this behind an
 * email-match confirmation modal (per contract §12); the engine does not
 * validate the email itself.
 */
export async function accountDelete(settings: AppSettings): Promise<AccountDeleteData> {
  return runBackupOnce<AccountDeleteData>(settings, 'account', ['delete', '--confirm']);
}

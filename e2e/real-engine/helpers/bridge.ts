import type { APIRequestContext, Page } from '@playwright/test';
import path from 'node:path';

/**
 * Helpers for the real-engine lane. These talk to the standalone dev bridge
 * (the same HTTP surface the app uses) to seed real profile files and to pull
 * ground-truth engine envelopes for cross-checking what the GUI rendered.
 *
 * There is deliberately NO mock anywhere in this directory — that is the whole
 * point of the lane. If the bridge or engine is missing, these calls throw and
 * the spec fails loudly.
 */
export const BRIDGE_URL = 'http://127.0.0.1:9876';

interface BridgeResponse<T = unknown> {
  ok: boolean;
  data: T;
  error?: string;
}

/** POST a command to the dev bridge, exactly as src/lib/http-bridge.ts does. */
export async function bridgeInvoke<T = unknown>(
  request: APIRequestContext,
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const res = await request.post(`${BRIDGE_URL}/api/invoke`, { data: { cmd, args } });
  if (!res.ok()) {
    throw new Error(`Bridge HTTP ${res.status()} for '${cmd}' — is the dev bridge up on 9876?`);
  }
  const body = (await res.json()) as BridgeResponse<T>;
  if (!body.ok) {
    throw new Error(`Bridge command '${cmd}' failed: ${body.error ?? 'unknown error'}`);
  }
  return body.data;
}

export interface SeededProfile {
  /** Absolute path of the written manifest (also the delete target). */
  path: string;
  /** Discovered profile name = manifest file basename, drives the card testid. */
  name: string;
}

export interface SeededInspectionProfile extends SeededProfile {
  /** Every copied raw-profile file, retained for precise cleanup. */
  copiedPaths: string[];
}

const INSPECTION_FIXTURE_FILES = [
  'manifest.jsonc',
  'metadata.json',
  'provenance/modules/included.json',
  'provenance/modules/absent.json',
];

/**
 * Copy the committed extracted profile fixture, including the sibling metadata
 * and provenance snapshots that `profile inspect` reads. Importing just a
 * manifest would test a different, incomplete profile shape.
 */
export async function seedInspectionProfile(
  request: APIRequestContext,
  name = 'ci-profile-inspection',
): Promise<SeededInspectionProfile> {
  const profilesDir = await bridgeInvoke<string>(request, 'get_default_profiles_directory');
  const fixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/profile-inspect-profile');
  const destinationRoot = path.join(profilesDir, name);
  const copiedPaths: string[] = [];

  for (const relativePath of INSPECTION_FIXTURE_FILES) {
    const destination = path.join(destinationRoot, relativePath);
    await bridgeInvoke(request, 'delete_file_silent', { path: destination }).catch(() => {});
    await bridgeInvoke(request, 'copy_file', {
      sourcePath: path.join(fixtureRoot, relativePath),
      destPath: destination,
    });
    copiedPaths.push(destination);
  }

  return { path: path.join(destinationRoot, 'manifest.jsonc'), name, copiedPaths };
}

/**
 * Write a real manifest into the engine's default profiles directory through
 * the same transactional import command the drop zone uses. Clears any prior
 * file of the same name first so the discovered name is deterministic (the
 * import de-dups otherwise, e.g. `name_1.jsonc`).
 */
export async function seedProfile(
  request: APIRequestContext,
  name: string,
  apps: Array<{ id: string; refs: { windows: string } }>,
): Promise<SeededProfile> {
  const profilesDir = await bridgeInvoke<string>(request, 'get_default_profiles_directory');
  // A fresh CI runner may not have the profiles directory yet.
  await bridgeInvoke(request, 'ensure_dir', { path: profilesDir }).catch(() => {});
  const canonicalPath = `${profilesDir}\\${name}.jsonc`;
  await bridgeInvoke(request, 'delete_file_silent', { path: canonicalPath }).catch(() => {});
  const content = JSON.stringify({ version: 1, name, apps });
  const path = await bridgeInvoke<string>(request, 'import_profile_text', {
    content,
    fileName: `${name}.jsonc`,
    profilesDir,
  });
  const discovered = path.replace(/^.*[\\/]/, '').replace(/\.jsonc$/, '');
  return { path, name: discovered };
}

/** Best-effort cleanup of a seeded profile file. */
export async function removeProfile(request: APIRequestContext, path: string): Promise<void> {
  await bridgeInvoke(request, 'delete_file_silent', { path }).catch(() => {});
}

/** Remove all raw fixture files written by seedInspectionProfile. */
export async function removeInspectionProfile(
  request: APIRequestContext,
  profile: SeededInspectionProfile,
): Promise<void> {
  await Promise.all(
    profile.copiedPaths.map((filePath) =>
      bridgeInvoke(request, 'delete_file_silent', { path: filePath }).catch(() => {}),
    ),
  );
}

export interface ApplyAction {
  id: string;
  ref: string;
  name: string;
  status: string;
  reason?: string;
}

export interface ApplyEnvelope {
  success: boolean;
  data: {
    dryRun: boolean;
    summary: { total: number; success: number; skipped: number; failed: number };
    actions: ApplyAction[];
  };
}

export interface ProfileInspectionEnvelope {
  schemaVersion: string;
  command: 'profile';
  success: true;
  error: null;
  data: {
    profile: {
      name: string | null;
      capturedAt: string | null;
      manifestVersion: number;
      manifestPath: string;
    };
    apps: Array<{
      id: string;
      displayName: string;
      hasSettings: boolean;
    }>;
    settingsApps: Array<{
      id: string;
      displayName: string;
      associationStatus: 'included' | 'not_in_profile' | 'ambiguous' | 'unresolved';
      appId: string | null;
      appIncluded: boolean;
    }>;
    warnings: Array<{ code: string; message: string; impact: 'diagnostic' | 'inventory_incomplete' }>;
    summary: {
      appCount: number;
      settingsRowCount: number;
      verifiedSettingsAppCount: number;
      unidentifiedSettingsRowCount: number;
    };
  };
}

/** Ground-truth, validated `profile inspect` response from the real engine. */
export async function profileInspectionEnvelope(
  request: APIRequestContext,
  profilePath: string,
): Promise<ProfileInspectionEnvelope> {
  const exec = await bridgeInvoke<{ stdout: string; stderr: string; exitCode: number }>(
    request,
    'endstate_exec',
    { exe: '__bundled__', args: ['profile', 'inspect', profilePath, '--json'] },
  );
  if (exec.exitCode !== 0) {
    throw new Error(`profile inspect exited ${exec.exitCode}: ${exec.stderr.trim()}`);
  }
  const envelope = JSON.parse(exec.stdout) as ProfileInspectionEnvelope;
  if (
    !/^1\./.test(envelope.schemaVersion) ||
    envelope.command !== 'profile' ||
    envelope.success !== true ||
    envelope.error !== null ||
    !Array.isArray(envelope.data?.apps) ||
    !Array.isArray(envelope.data?.settingsApps) ||
    !Array.isArray(envelope.data?.warnings) ||
    envelope.data.summary.appCount !== envelope.data.apps.length ||
    envelope.data.summary.settingsRowCount !== envelope.data.settingsApps.length
  ) {
    throw new Error('Real engine returned an incompatible profile inspection envelope');
  }
  return envelope;
}

/**
 * Ground-truth dry-run apply envelope straight from the engine via the bridge.
 * Used to assert the GUI rendered what the engine actually reported, rather
 * than pinning host-dependent values into the spec.
 */
export async function dryRunApplyEnvelope(
  request: APIRequestContext,
  profilePath: string,
): Promise<ApplyEnvelope> {
  const exec = await bridgeInvoke<{ stdout: string; stderr: string; exit_code: number }>(
    request,
    'endstate_exec',
    { exe: '__bundled__', args: ['apply', '--profile', profilePath, '--dry-run', '--json'] },
  );
  return JSON.parse(exec.stdout) as ApplyEnvelope;
}

/**
 * Seed GUI settings BEFORE the app boots so every apply this lane triggers is a
 * dry run — nothing is ever installed, so the lane is safe to run per-PR on a
 * real Windows host with no side effects or UAC prompts.
 *
 * dryRunEnabled=true reproduces the exact configuration that shipped the July
 * "Setup complete" defect (#163): the primary Apply action appends --dry-run
 * and installs nothing. `dryRunDefaultCorrected: true` is REQUIRED — without it
 * loadSettings()'s one-time correction (settings.ts::applyDryRunDefaultCorrection)
 * force-clears dryRunEnabled to false, and the apply would perform a real
 * install. Setting the flag marks the correction as already applied so the
 * seeded preference is honored.
 */
export async function seedDryRunSettings(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'test:endstate-gui-settings',
      JSON.stringify({ dryRunEnabled: true, dryRunDefaultCorrected: true, showDetails: true }),
    );
  });
}

/**
 * "What's inside" — a human summary of what a capture bundle contains.
 *
 * Profiles reachable from the Set up flow are already imported and extracted, so
 * `manifest.jsonc` and its sibling `provenance/modules/*.json` snapshots are
 * plain files on disk. This module reads those and nothing else: no engine
 * spawn, no zip handling.
 *
 * Raw module ids are deliberately never used as a label. An id that cannot be
 * resolved to a friendly name yields a counted-but-unnamed module rather than a
 * row reading `apps.notepad-plus-plus`. The ids travel separately in
 * `moduleIds`, for the "Configuration details" disclosure only — see
 * openspec/specs/config-generation-presentation/spec.md and the guard in
 * `moduleDisplayNameMap` (setup-flow.tsx) this mirrors.
 */

import { invoke } from './tauri-bridge';
import {
  parseJsonc,
  type ProfileApp,
  type ProfileManifest,
  type ProfileModuleSnapshot,
} from './jsonc-parse';

const APPS_PREFIX = 'apps.';

/** One settings module the profile carries, named and counted. */
export interface ProfileSettingsModule {
  /** Friendly label. Never a raw module id. */
  label: string;
  /** Config files (v2) or restore entries (v1) this module contributes. */
  entryCount: number;
}

export interface ProfileContents {
  /** Manifest-declared profile name, empty when the manifest omits it. */
  profileName: string;
  /** ISO 8601 capture timestamp, or null when the manifest omits it. */
  captured: string | null;
  /** App labels, in manifest order. */
  apps: string[];
  /** Named settings modules. Shorter than `settingsModuleCount` if any id was unresolvable. */
  settings: ProfileSettingsModule[];
  /** Distinct settings modules the profile carries, including unnamed ones. */
  settingsModuleCount: number;
  /** Total config files / restore entries across all modules. */
  settingsEntryCount: number;
  /** Raw module ids, sorted. Disclosure-only — never render these as labels. */
  moduleIds: string[];
  manifestVersion: number | null;
}

/** Strip the `apps.` namespace so `apps.vlc` and `vlc` resolve to one another. */
export function shortModuleId(moduleId: string): string {
  return moduleId.startsWith(APPS_PREFIX) ? moduleId.slice(APPS_PREFIX.length) : moduleId;
}

/**
 * Derive a module id from a v1 restore source path.
 * `./configs/notepad-plus-plus/config.xml` → `notepad-plus-plus`.
 */
export function moduleIdFromRestoreSource(source: string | undefined): string | null {
  if (!source) return null;
  const match = /(?:^|[\\/])configs[\\/]([^\\/]+)[\\/]/.exec(source);
  return match ? match[1] : null;
}

/**
 * The friendly label for an app row: the captured display name, else the
 * package ref, else the manifest id. This is the same chain `ViewAppsModal`
 * uses, plus the `displayName` capture actually writes.
 */
export function appLabel(app: ProfileApp): string {
  const display = app.displayName?.trim() || app.name?.trim();
  if (display) return display;
  const ref = app.refs?.windows?.trim();
  if (ref) return ref;
  return app.id;
}

/**
 * Index every alias of a module id to a friendly name.
 *
 * A candidate equal to the id it describes is provenance echoed back, not copy,
 * and is rejected — the same rule `moduleDisplayNameMap` applies to engine
 * `RestoreModuleRef`s.
 */
function indexModuleName(
  index: Map<string, string>,
  moduleId: string | undefined,
  candidate: string | undefined,
): void {
  const id = moduleId?.trim();
  const label = candidate?.trim();
  if (!id || !label) return;

  const short = shortModuleId(id);
  const qualified = `${APPS_PREFIX}${short}`;
  if (label === id || label === short || label === qualified) return;

  index.set(id, label);
  index.set(short, label);
  index.set(qualified, label);
}

/**
 * Build the module-id → friendly-name index.
 *
 * Module snapshots win: they carry the catalog's own display name. The app list
 * is the fallback, and works because a v1 module id is the app id that owns it.
 */
function buildModuleLabelIndex(
  manifest: ProfileManifest,
  snapshotNames: Readonly<Record<string, string>>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const app of manifest.apps ?? []) {
    if (!app?.id) continue;
    indexModuleName(index, app.id, appLabel(app));
  }
  for (const [moduleId, displayName] of Object.entries(snapshotNames)) {
    indexModuleName(index, moduleId, displayName);
  }

  return index;
}

interface ModuleTally {
  moduleId: string;
  entryCount: number;
  /** Package ref from capture evidence — a usable label when nothing else resolves. */
  evidenceRef?: string;
}

/** Aggregate the manifest's settings lane into per-module tallies, in first-seen order. */
function tallySettingsModules(manifest: ProfileManifest): ModuleTally[] {
  const tallies: ModuleTally[] = [];
  const byId = new Map<string, ModuleTally>();

  const add = (moduleId: string | undefined, entryCount: number, evidenceRef?: string) => {
    const id = moduleId?.trim();
    if (!id) return;
    let tally = byId.get(id);
    if (!tally) {
      tally = { moduleId: id, entryCount: 0 };
      byId.set(id, tally);
      tallies.push(tally);
    }
    tally.entryCount += entryCount;
    if (!tally.evidenceRef && evidenceRef?.trim()) tally.evidenceRef = evidenceRef.trim();
  };

  // v2 is authoritative when present: a manifest carrying configCaptures
  // describes the same payload through `legacyConfigLanes`, so counting the
  // flat `restore` list too would double-report it.
  const captures = manifest.configCaptures ?? [];
  if (captures.length > 0) {
    for (const capture of captures) {
      add(
        capture?.moduleId,
        capture?.payloadManifest?.length ?? 0,
        capture?.sourceInstance?.evidence?.ref,
      );
    }
    return tallies;
  }

  for (const entry of manifest.restore ?? []) {
    add(entry?.fromModule ?? moduleIdFromRestoreSource(entry?.source) ?? undefined, 1);
  }
  return tallies;
}

/**
 * Summarize a parsed manifest.
 *
 * @param snapshotNames module id → display name, read from the bundle's module
 *   snapshots. Optional: without it, labels fall back to the app list.
 */
export function summarizeProfileManifest(
  manifest: ProfileManifest,
  snapshotNames: Readonly<Record<string, string>> = {},
): ProfileContents {
  const labelIndex = buildModuleLabelIndex(manifest, snapshotNames);
  const tallies = tallySettingsModules(manifest);

  const settings: ProfileSettingsModule[] = [];
  for (const tally of tallies) {
    const label =
      labelIndex.get(tally.moduleId) ??
      labelIndex.get(shortModuleId(tally.moduleId)) ??
      tally.evidenceRef;
    // No friendly name resolved: the module still counts, but showing its id
    // here would leak provenance into the distilled summary.
    if (!label) continue;
    settings.push({ label, entryCount: tally.entryCount });
  }

  const captured = manifest.captured?.trim();

  return {
    profileName: manifest.name?.trim() ?? '',
    captured: captured || null,
    apps: (manifest.apps ?? []).filter((app) => app?.id).map(appLabel),
    settings,
    settingsModuleCount: tallies.length,
    settingsEntryCount: tallies.reduce((total, tally) => total + tally.entryCount, 0),
    moduleIds: tallies.map((tally) => tally.moduleId).sort(),
    manifestVersion: typeof manifest.version === 'number' ? manifest.version : null,
  };
}

/** The directory holding the manifest — where the bundle's payload sits. */
function bundleDirOf(manifestPath: string): string {
  return manifestPath.replace(/[\\/][^\\/]+$/, '');
}

/**
 * A snapshot path is engine-authored and constrained to `provenance/modules/`.
 * Re-check it here anyway: this value drives a file read, and the manifest is
 * untrusted input.
 */
function isSafeSnapshotPath(snapshotPath: string | undefined): snapshotPath is string {
  if (!snapshotPath) return false;
  const normalized = snapshotPath.replace(/\\/g, '/');
  return normalized.startsWith('provenance/modules/') && !normalized.includes('..');
}

/**
 * Read the module snapshots a v2 bundle ships, for their display names.
 *
 * Best-effort by design: a bundle missing or carrying an unreadable snapshot
 * still summarizes fine, it just falls back to app-derived labels.
 */
async function readSnapshotDisplayNames(
  manifestPath: string,
  manifest: ProfileManifest,
): Promise<Record<string, string>> {
  const paths = new Set<string>();
  for (const capture of manifest.configCaptures ?? []) {
    const snapshotPath = capture?.captureModule?.snapshotPath;
    if (isSafeSnapshotPath(snapshotPath)) paths.add(snapshotPath.replace(/\\/g, '/'));
  }
  if (paths.size === 0) return {};

  const dir = bundleDirOf(manifestPath);
  const names: Record<string, string> = {};

  await Promise.all(
    [...paths].map(async (snapshotPath) => {
      try {
        const path = `${dir}\\${snapshotPath.replace(/\//g, '\\')}`;
        const content = await invoke<string>('read_text_file', { path });
        const snapshot = parseJsonc<ProfileModuleSnapshot>(content);
        if (snapshot?.id && snapshot.displayName) {
          names[snapshot.id] = snapshot.displayName;
        }
      } catch {
        // A missing or malformed snapshot is not an error the user needs to see.
      }
    }),
  );

  return names;
}

/**
 * Load and summarize an extracted profile.
 *
 * @param manifestPath absolute path to the profile's `manifest.jsonc`
 *   (`DiscoveredProfile.path`).
 * @throws when the manifest cannot be read or parsed.
 */
export async function loadProfileContents(manifestPath: string): Promise<ProfileContents> {
  const content = await invoke<string>('read_text_file', { path: manifestPath });
  const manifest = parseJsonc<ProfileManifest>(content);
  const snapshotNames = await readSnapshotDisplayNames(manifestPath, manifest);
  return summarizeProfileManifest(manifest, snapshotNames);
}

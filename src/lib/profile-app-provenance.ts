import type { ApplyAction } from '@/types';
import { parseJsonc, type ProfileManifest } from './jsonc-parse';

/** Read the app ids the user actually authored in the imported profile. */
export function parseAuthoredProfileAppIds(content: string): Set<string> {
  const manifest = parseJsonc<ProfileManifest>(content);
  return new Set(
    (manifest.apps ?? [])
      .map((app) => app.id?.trim())
      .filter((id): id is string => !!id),
  );
}

type ProfileTextReader = (path: string) => Promise<string>;

function cleanPath(path: string, separator: '\\' | '/'): string {
  const normalized = path.replace(/[\\/]/g, separator);
  const driveMatch = separator === '\\' ? normalized.match(/^[A-Za-z]:\\/) : null;
  const isUnc = separator === '\\' && normalized.startsWith('\\\\');
  const isPosixAbsolute = separator === '/' && normalized.startsWith('/');
  const prefix = driveMatch?.[0] ?? (isUnc ? '\\\\' : isPosixAbsolute ? '/' : '');
  const remainder = normalized.slice(prefix.length);
  const segments: string[] = [];

  for (const segment of remainder.split(separator)) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!prefix) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  return `${prefix}${segments.join(separator)}`;
}

function resolveIncludePath(parentPath: string, includePath: string): string {
  const windows = /^[A-Za-z]:[\\/]/.test(parentPath)
    || parentPath.startsWith('\\\\')
    || parentPath.includes('\\');
  const separator = windows ? '\\' : '/';
  const absolute = /^[A-Za-z]:[\\/]/.test(includePath)
    || includePath.startsWith('/')
    || includePath.startsWith('\\\\');
  if (absolute) return cleanPath(includePath, separator);

  const parentDirectory = parentPath.replace(/[\\/][^\\/]*$/, '');
  return cleanPath(`${parentDirectory}${separator}${includePath}`, separator);
}

/** Load the complete authored app set using the engine's recursive include model. */
export async function loadAuthoredProfileAppIds(
  rootPath: string,
  readText: ProfileTextReader,
): Promise<Set<string>> {
  const authoredAppIds = new Set<string>();
  const loadedPaths = new Set<string>();
  const activePaths = new Set<string>();

  const load = async (path: string): Promise<void> => {
    const windows = /^[A-Za-z]:[\\/]/.test(path) || path.includes('\\');
    const clean = cleanPath(path, windows ? '\\' : '/');
    const key = windows ? clean.toLowerCase() : clean;
    if (activePaths.has(key)) {
      throw new Error(`Circular profile include: ${clean}`);
    }
    if (loadedPaths.has(key)) return;

    activePaths.add(key);
    const content = await readText(clean);
    const manifest = parseJsonc<ProfileManifest>(content);
    for (const id of parseAuthoredProfileAppIds(content)) {
      authoredAppIds.add(id);
    }
    for (const includePath of manifest.includes ?? []) {
      await load(resolveIncludePath(clean, includePath));
    }
    activePaths.delete(key);
    loadedPaths.add(key);
  };

  await load(rootPath);
  return authoredAppIds;
}

/**
 * The engine may append ref-less manual rows for config modules after loading
 * the manifest. Comparing its plan with the source profile gives those rows
 * explicit provenance without confusing them with user-authored manual apps.
 */
export function findSynthesizedManualAppIds(
  actions: ApplyAction[] | undefined,
  authoredAppIds: Set<string>,
): string[] {
  return (actions ?? [])
    .filter((action) =>
      !!action.id
      && !action.ref
      && action.driver === 'manual'
      && !authoredAppIds.has(action.id),
    )
    .map((action) => action.id);
}

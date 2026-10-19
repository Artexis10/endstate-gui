/**
 * Which group a settings module belongs to, read from its module ID.
 *
 * The engine names every catalog module `<tier>.<name>`: the tier is the
 * catalog directory the module lives in (`modules/<tier>/` in the engine).
 * Modules of the `apps` tier hold an app's settings. Modules of any other tier
 * hold settings that belong to no app, and the engine never shows them as an
 * app. An ID without a tier comes from an engine that predates tiers, when
 * every module belonged to an app.
 */

export type SettingsKind = 'app' | 'windows' | 'other';

// The engine's own name for its app tier (`modules.AppsTier`).
const APP_TIER = 'apps';
// The one non-app tier the engine catalog ships (`modules/windows-settings/`).
// The engine has no display label for a tier, so the GUI names this one; a
// tier the GUI does not know still shows, as "Other settings".
const WINDOWS_TIER = 'windows-settings';

function moduleTier(moduleId: string): string | null {
  const dot = moduleId.indexOf('.');
  return dot > 0 ? moduleId.slice(0, dot) : null;
}

export function settingsKind(moduleId: string): SettingsKind {
  const tier = moduleTier(moduleId.trim());
  if (tier === null || tier === APP_TIER) return 'app';
  return tier === WINDOWS_TIER ? 'windows' : 'other';
}

/**
 * The key that matches one app module across engine sources: some sources
 * qualify an app module (`apps.vscode`) and others do not (`vscode`). Modules
 * of other tiers are always qualified, so their full ID is the key.
 */
export function appModuleKey(moduleId: string): string {
  const prefix = `${APP_TIER}.`;
  return moduleId.startsWith(prefix) ? moduleId.slice(prefix.length) : moduleId;
}

/**
 * User-facing names for the settings groups that belong to no app. `entry`
 * names one restore entry of such a module: a Windows settings module restores
 * single values, not files.
 */
export const SETTINGS_GROUP_COPY: Record<Exclude<SettingsKind, 'app'>, {
  heading: string;
  singular: string;
  plural: string;
  entry: { singular: string; plural: string };
}> = {
  windows: {
    heading: 'Windows settings',
    singular: 'Windows setting',
    plural: 'Windows settings',
    entry: { singular: 'value', plural: 'values' },
  },
  other: {
    heading: 'Other settings',
    singular: 'other setting',
    plural: 'other settings',
    entry: { singular: 'entry', plural: 'entries' },
  },
};

/** The non-app groups in the order every screen lists them. */
export const NON_APP_SETTINGS_KINDS = ['windows', 'other'] as const;

export function countSettingsPhrase(kind: Exclude<SettingsKind, 'app'>, count: number): string {
  const copy = SETTINGS_GROUP_COPY[kind];
  return `${count} ${count === 1 ? copy.singular : copy.plural}`;
}

/**
 * Counts settings modules with one number per group, so no number mixes app
 * settings with settings that belong to no app: "40 app settings and 7 Windows
 * settings". A profile with app settings only keeps the plain "40 settings".
 */
export function settingsModulesPhrase(moduleIds: readonly string[]): string {
  const appCount = moduleIds.filter((id) => settingsKind(id) === 'app').length;
  const nonAppParts = NON_APP_SETTINGS_KINDS
    .map((kind) => ({ kind, count: moduleIds.filter((id) => settingsKind(id) === kind).length }))
    .filter(({ count }) => count > 0)
    .map(({ kind, count }) => countSettingsPhrase(kind, count));
  const settingsWord = appCount === 1 ? 'setting' : 'settings';
  if (nonAppParts.length === 0) return `${appCount} ${settingsWord}`;
  return [...(appCount > 0 ? [`${appCount} app ${settingsWord}`] : []), ...nonAppParts].join(' and ');
}

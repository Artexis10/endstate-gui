import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { MIN_MODULE_COUNT, validateEngineResources } from './engine-resources.mjs';

function portableName(value) {
  const normalized = String(value).replaceAll('\\', '/');
  const longName = normalized.includes('|') ? normalized.slice(normalized.lastIndexOf('|') + 1) : normalized;
  return longName.trim().replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
}

export function auditInventory(entries, expectedModuleCount = MIN_MODULE_COUNT) {
  const names = entries.map(portableName).filter(Boolean);
  const normalized = names.map(name => name.toLowerCase());
  const moduleCount = normalized.filter(name => /^engine\/modules\/.+\/module\.jsonc$/.test(name)).length;
  const errors = [];
  if (!normalized.includes('endstate.exe')) errors.push('installer is missing endstate.exe at the install root');
  if (!normalized.includes('engine/schema_version')) errors.push('installer is missing engine/SCHEMA_VERSION');
  if (moduleCount !== expectedModuleCount) {
    errors.push(`installer has ${moduleCount} engine/modules/**/module.jsonc entries; expected exactly ${expectedModuleCount}`);
  }
  return { valid: errors.length === 0, errors, moduleCount, fileCount: names.length };
}

function msiTargetName(defaultDir) {
  const target = String(defaultDir ?? '').split(':', 1)[0];
  const name = portableName(target);
  return name === '.' ? '' : name;
}

export function reconstructMsiInventory({ files, components, directories }, installRoot = 'INSTALLDIR') {
  const componentDirectories = new Map([].concat(components ?? []).map(row => [row.component, row.directory]));
  const directoryRows = new Map([].concat(directories ?? []).map(row => [row.directory, row]));
  const cache = new Map([[installRoot, '']]);
  const resolving = new Set();

  function relativeDirectory(directory) {
    if (cache.has(directory)) return cache.get(directory);
    if (resolving.has(directory)) throw new Error(`MSI Directory table contains a cycle at ${directory}`);
    const row = directoryRows.get(directory);
    if (!row) return null;
    resolving.add(directory);
    const parentPath = relativeDirectory(row.parent);
    resolving.delete(directory);
    if (parentPath === null) return null;
    const segment = msiTargetName(row.defaultDir);
    const path = [parentPath, segment].filter(Boolean).join('/');
    cache.set(directory, path);
    return path;
  }

  return [].concat(files ?? []).flatMap(file => {
    const directory = componentDirectories.get(file.component);
    const directoryPath = relativeDirectory(directory);
    const fileName = portableName(file.fileName);
    if (directoryPath === null || !fileName) return [];
    return [[directoryPath, fileName].filter(Boolean).join('/')];
  });
}

export function readMsiInventory(msiPath) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$installer = New-Object -ComObject WindowsInstaller.Installer',
    '$database = $installer.OpenDatabase($env:ENDSTATE_MSI_PATH, 0)',
    "$view = $database.OpenView('SELECT `File`, `Component_`, `FileName` FROM `File`')",
    '$view.Execute()',
    '$files = @()',
    'while ($record = $view.Fetch()) { $files += [pscustomobject]@{ file = [string]$record.StringData(1); component = [string]$record.StringData(2); fileName = [string]$record.StringData(3) } }',
    '$view.Close()',
    "$view = $database.OpenView('SELECT `Component`, `Directory_` FROM `Component`')",
    '$view.Execute()',
    '$components = @()',
    'while ($record = $view.Fetch()) { $components += [pscustomobject]@{ component = [string]$record.StringData(1); directory = [string]$record.StringData(2) } }',
    '$view.Close()',
    "$view = $database.OpenView('SELECT `Directory`, `Directory_Parent`, `DefaultDir` FROM `Directory`')",
    '$view.Execute()',
    '$directories = @()',
    'while ($record = $view.Fetch()) { $directories += [pscustomobject]@{ directory = [string]$record.StringData(1); parent = [string]$record.StringData(2); defaultDir = [string]$record.StringData(3) } }',
    '$view.Close()',
    'ConvertTo-Json -Depth 4 -Compress -InputObject ([pscustomobject]@{ files = $files; components = $components; directories = $directories })',
  ].join('; ');
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    env: { ...process.env, ENDSTATE_MSI_PATH: resolve(msiPath) },
  });
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `PowerShell exited ${result.status}`;
    throw new Error(`MSI inventory failed: ${detail.trim()}`);
  }
  return reconstructMsiInventory(JSON.parse(result.stdout.trim()));
}

export function sevenZipExecutable() {
  const installed = process.env.ProgramFiles && `${process.env.ProgramFiles}\\7-Zip\\7z.exe`;
  return installed && existsSync(installed) ? installed : '7z';
}

export function readNsisInventory(installerPath) {
  const result = spawnSync(sevenZipExecutable(), ['l', '-slt', resolve(installerPath)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`NSIS inventory failed: ${(result.stderr || result.stdout).trim()}`);
  const lines = result.stdout.split(/\r?\n/);
  const entriesStart = lines.findIndex(line => /^-{10,}$/.test(line.trim()));
  return lines
    .slice(entriesStart >= 0 ? entriesStart + 1 : 0)
    .filter(line => line.startsWith('Path = '))
    .map(line => portableName(line.slice('Path = '.length)))
    .filter(Boolean);
}

export function auditInstaller(installerPath, expectedModuleCount = MIN_MODULE_COUNT) {
  const extension = extname(installerPath).toLowerCase();
  const inventory = extension === '.msi'
    ? readMsiInventory(installerPath)
    : extension === '.exe'
      ? readNsisInventory(installerPath)
      : (() => { throw new Error(`unsupported installer type: ${installerPath}`); })();
  return { artifact: resolve(installerPath), ...auditInventory(inventory, expectedModuleCount) };
}

export function validateCatalogSmokeEnvelope(envelope) {
  if (!envelope || envelope.success !== true) {
    throw new Error(`packaged engine catalog smoke failed: ${envelope?.error?.message ?? 'unsuccessful envelope'}`);
  }
  const restoreModules = Array.isArray(envelope.data?.restoreModulesAvailable)
    ? envelope.data.restoreModulesAvailable
    : [];
  if (!restoreModules.some(module => module?.id === 'apps.git')) {
    throw new Error('packaged engine did not load expected catalog module apps.git');
  }
}

function main() {
  const stageRootIndex = process.argv.indexOf('--stage-root');
  const stageRoot = stageRootIndex >= 0 ? process.argv[stageRootIndex + 1] : 'src-tauri/engine';
  const artifacts = process.argv.slice(2).filter((argument, index, all) => (
    argument !== '--stage-root' && all[index - 1] !== '--stage-root'
  ));
  if (artifacts.length === 0) throw new Error('usage: node scripts/audit-windows-installer.mjs <installer.msi|installer.exe> [...]');
  const expectedModuleCount = validateEngineResources(stageRoot).moduleCount;
  let failed = false;
  for (const artifact of artifacts) {
    const result = auditInstaller(artifact, expectedModuleCount);
    if (result.valid) {
      console.log(`PASS ${result.artifact}: ${result.fileCount} files, exact ${result.moduleCount}-module staged catalog at engine/modules, endstate.exe and engine/SCHEMA_VERSION present`);
    } else {
      failed = true;
      console.error(`FAIL ${result.artifact}: ${result.errors.join('; ')}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { MIN_MODULE_COUNT } from './engine-resources.mjs';

function portableName(value) {
  const normalized = String(value).replaceAll('\\', '/');
  const longName = normalized.includes('|') ? normalized.slice(normalized.lastIndexOf('|') + 1) : normalized;
  return longName.trim();
}

export function auditInventory(entries, minimumModules = MIN_MODULE_COUNT) {
  const names = entries.map(portableName).filter(Boolean);
  const basenames = names.map(name => basename(name).toLowerCase());
  const moduleCount = basenames.filter(name => name === 'module.jsonc').length;
  const errors = [];
  if (!basenames.includes('endstate.exe')) errors.push('installer is missing endstate.exe');
  if (!basenames.includes('schema_version')) errors.push('installer is missing SCHEMA_VERSION');
  if (moduleCount < minimumModules) {
    errors.push(`installer has ${moduleCount} module.jsonc entries; expected at least ${minimumModules} module.jsonc entries`);
  }
  return { valid: errors.length === 0, errors, moduleCount, fileCount: names.length };
}

export function readMsiInventory(msiPath) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$installer = New-Object -ComObject WindowsInstaller.Installer',
    '$database = $installer.OpenDatabase($env:ENDSTATE_MSI_PATH, 0)',
    "$view = $database.OpenView('SELECT `FileName` FROM `File`')",
    '$view.Execute()',
    '$names = @()',
    'while ($record = $view.Fetch()) { $names += [string]$record.StringData(1) }',
    '$view.Close()',
    'ConvertTo-Json -Compress -InputObject @($names)',
  ].join('; ');
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    env: { ...process.env, ENDSTATE_MSI_PATH: resolve(msiPath) },
  });
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `PowerShell exited ${result.status}`;
    throw new Error(`MSI inventory failed: ${detail.trim()}`);
  }
  const parsed = JSON.parse(result.stdout.trim());
  return Array.isArray(parsed) ? parsed : [parsed];
}

function sevenZipExecutable() {
  const installed = process.env.ProgramFiles && `${process.env.ProgramFiles}\\7-Zip\\7z.exe`;
  return installed && existsSync(installed) ? installed : '7z';
}

export function readNsisInventory(installerPath) {
  const result = spawnSync(sevenZipExecutable(), ['l', '-slt', resolve(installerPath)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`NSIS inventory failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout
    .split(/\r?\n/)
    .filter(line => line.startsWith('Path = '))
    .map(line => line.slice('Path = '.length));
}

export function auditInstaller(installerPath) {
  const extension = extname(installerPath).toLowerCase();
  const inventory = extension === '.msi'
    ? readMsiInventory(installerPath)
    : extension === '.exe'
      ? readNsisInventory(installerPath)
      : (() => { throw new Error(`unsupported installer type: ${installerPath}`); })();
  return { artifact: resolve(installerPath), ...auditInventory(inventory) };
}

function main() {
  const artifacts = process.argv.slice(2);
  if (artifacts.length === 0) throw new Error('usage: node scripts/audit-windows-installer.mjs <installer.msi|installer.exe> [...]');
  let failed = false;
  for (const artifact of artifacts) {
    const result = auditInstaller(artifact);
    if (result.valid) {
      console.log(`PASS ${result.artifact}: ${result.fileCount} files, ${result.moduleCount} modules, endstate.exe and SCHEMA_VERSION present`);
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

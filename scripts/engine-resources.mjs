import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MIN_MODULE_COUNT = 300;

function countFilesNamed(root, wantedName) {
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) count += countFilesNamed(entryPath, wantedName);
    else if (entry.isFile() && entry.name === wantedName) count += 1;
  }
  return count;
}

export function validateEngineResources(root, minimumModules = MIN_MODULE_COUNT) {
  const resolvedRoot = resolve(root);
  const schemaPath = join(resolvedRoot, 'SCHEMA_VERSION');
  const modulesPath = join(resolvedRoot, 'modules');
  if (!existsSync(schemaPath) || !statSync(schemaPath).isFile()) {
    throw new Error(`engine resources missing SCHEMA_VERSION: ${schemaPath}`);
  }
  const schemaVersion = readFileSync(schemaPath, 'utf8').trim();
  if (!schemaVersion) throw new Error(`engine SCHEMA_VERSION is empty: ${schemaPath}`);
  if (!existsSync(modulesPath) || !statSync(modulesPath).isDirectory()) {
    throw new Error(`engine resources missing modules directory: ${modulesPath}`);
  }
  const moduleCount = countFilesNamed(modulesPath, 'module.jsonc');
  if (moduleCount < minimumModules) {
    throw new Error(`engine module catalog has ${moduleCount} module.jsonc files; expected at least ${minimumModules}`);
  }
  return { root: resolvedRoot, schemaVersion, moduleCount };
}

export function resolveEngineSourceRoot({ guiRoot, override } = {}) {
  const repositoryRoot = resolve(guiRoot ?? fileURLToPath(new URL('..', import.meta.url)));
  const explicit = override ?? process.env.ENDSTATE_ENGINE_SOURCE;
  const candidates = explicit
    ? [resolve(explicit)]
    : [join(repositoryRoot, 'endstate'), resolve(repositoryRoot, '..', 'endstate')];
  const sourceRoot = candidates.find(candidate => existsSync(join(candidate, 'modules')));
  if (!sourceRoot) {
    throw new Error(`unable to locate engine resources; checked: ${candidates.join(', ')}. Set ENDSTATE_ENGINE_SOURCE or pass --engine-root.`);
  }
  return sourceRoot;
}

export async function stageEngineResources({ sourceRoot, destinationRoot } = {}) {
  const source = resolve(sourceRoot ?? resolveEngineSourceRoot());
  const destination = resolve(destinationRoot ?? fileURLToPath(new URL('../src-tauri/engine', import.meta.url)));
  if (source === destination) throw new Error('engine resource source and destination must differ');

  const sourceFacts = validateEngineResources(source);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await copyFile(join(source, 'SCHEMA_VERSION'), join(destination, 'SCHEMA_VERSION'));
  await cp(join(source, 'modules'), join(destination, 'modules'), { recursive: true });
  const stagedFacts = validateEngineResources(destination);
  if (stagedFacts.moduleCount !== sourceFacts.moduleCount) {
    throw new Error(`staged module count ${stagedFacts.moduleCount} does not match source count ${sourceFacts.moduleCount}`);
  }
  return { ...stagedFacts, sourceRoot: source, destinationRoot: destination };
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const sourceRoot = resolveEngineSourceRoot({ override: readOption('--engine-root') });
  const result = await stageEngineResources({
    sourceRoot,
    destinationRoot: readOption('--destination'),
  });
  console.log(`Staged ${result.moduleCount} engine modules and SCHEMA_VERSION ${result.schemaVersion} from ${result.sourceRoot} to ${result.destinationRoot}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

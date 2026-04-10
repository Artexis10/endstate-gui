/**
 * Capture extra marketing screenshots for future use.
 * Run: node scripts/capture-extras.mjs
 * Requires: dev server running at http://127.0.0.1:1420
 *
 * Saves to screenshots/extras/:
 *   04-setup-restore-preview.png — Preview with "apps and restore settings" selected
 *   05-apply-done-restored.png   — Apply complete with settings restored
 *   06-capture-scanning.png      — Save flow mid-scan with live activity
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'screenshots', 'extras');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://127.0.0.1:1420';
const SCALE = 2;

// ── Mock Data ─────────────────────────────────────────────────────

const MOCK_APPS = [
  { id: 'Anthropic.ClaudeCode', name: 'Claude Code', status: 'to_install', reason: null, driver: 'winget' },
  { id: 'Hashicorp.Terraform', name: 'Terraform', status: 'to_install', reason: null, driver: 'winget' },
  { id: 'Pulumi.Pulumi', name: 'Pulumi', status: 'to_install', reason: null, driver: 'winget' },
  { id: '7zip.7zip', name: '7-Zip 25.01 (x64)', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Adobe.CreativeCloud', name: 'Adobe Creative Cloud', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Anthropic.Claude', name: 'Claude Desktop', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Apple.MobileDeviceSupport', name: 'Apple Mobile Device Support', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Apple.SoftwareUpdate', name: 'Apple Software Update', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Bitwarden.Bitwarden', name: 'Bitwarden', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Brave.Brave', name: 'Brave', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'BurntSushi.ripgrep.MSVC', name: 'RipGrep MSVC', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Bytedance.CapCut', name: 'CapCut', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Cloudflare.cloudflared', name: 'cloudflared', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Codeium.Windsurf', name: 'Windsurf (User)', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Cryptomator.Cryptomator', name: 'Cryptomator', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Discord.Discord', name: 'Discord', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Docker.DockerDesktop', name: 'Docker Desktop', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Figma.Figma', name: 'Figma', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Git.Git', name: 'Git', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'GIMP.GIMP', name: 'GIMP', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'GitHub.cli', name: 'GitHub CLI', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'GitHub.GitHubDesktop', name: 'GitHub Desktop', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'GoLang.Go', name: 'Go', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Google.Chrome', name: 'Google Chrome', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Insomnia.Insomnia', name: 'Insomnia', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'JetBrains.IntelliJIDEA.Ultimate', name: 'IntelliJ IDEA Ultimate', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'JetBrains.Rider', name: 'Rider', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'junegunn.fzf', name: 'fzf', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'KeePassXCTeam.KeePassXC', name: 'KeePassXC', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Kubernetes.kubectl', name: 'kubectl', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.AzureCLI', name: 'Azure CLI', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.DotNet.SDK.8', name: '.NET SDK 8.0', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.PowerShell', name: 'PowerShell', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.PowerToys', name: 'PowerToys', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.WindowsTerminal', name: 'Windows Terminal', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Mozilla.Firefox', name: 'Firefox', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Notion.Notion', name: 'Notion', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Notepad++.Notepad++', name: 'Notepad++', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'OBSProject.OBSStudio', name: 'OBS Studio', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Obsidian.Obsidian', name: 'Obsidian', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'OpenJS.NodeJS', name: 'Node.js', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'OpenVPNTechnologies.OpenVPN', name: 'OpenVPN', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Postman.Postman', name: 'Postman', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'PuTTY.PuTTY', name: 'PuTTY', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Python.Python.3.12', name: 'Python 3.12', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Rustlang.Rustup', name: 'rustup', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'sharkdp.bat', name: 'bat', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'sharkdp.fd', name: 'fd', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'SlackTechnologies.Slack', name: 'Slack', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Spotify.Spotify', name: 'Spotify', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'SublimeHQ.SublimeMerge', name: 'Sublime Merge', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Transmission.Transmission', name: 'Transmission', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Valve.Steam', name: 'Steam', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'VideoLAN.VLC', name: 'VLC Media Player', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'WinMerge.WinMerge', name: 'WinMerge', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'WinSCP.WinSCP', name: 'WinSCP', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'ajeetdsouza.zoxide', name: 'zoxide', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Zoom.Zoom', name: 'Zoom', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'RealVNC.VNCViewer', name: 'VNC Viewer', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'WireGuard.WireGuard', name: 'WireGuard', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Audacity.Audacity', name: 'Audacity', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'HandBrake.HandBrake', name: 'HandBrake', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'ShareX.ShareX', name: 'ShareX', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'gerardog.gsudo', name: 'gsudo', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Microsoft.Sysinternals.ProcessExplorer', name: 'Process Explorer', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Starship.Starship', name: 'Starship', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Casey.Just', name: 'Just', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'FiloSottile.age', name: 'age', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'eza-community.eza', name: 'eza', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'dandavison.delta', name: 'delta', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Byron.dua-cli', name: 'dua', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'Elgato.StreamDeck', name: 'Stream Deck', status: 'present', reason: 'already_installed', driver: 'winget' },
  { id: 'tailscale.tailscale', name: 'Tailscale', status: 'present', reason: 'already_installed', driver: 'winget' },
];

const MOCK_RESTORE_MODULES = [
  { id: 'vscode', displayName: 'Visual Studio Code' },
  { id: 'git', displayName: 'Git' },
  { id: 'windows-terminal', displayName: 'Windows Terminal' },
  { id: 'powershell', displayName: 'PowerShell' },
  { id: 'powertoys', displayName: 'PowerToys' },
  { id: 'starship', displayName: 'Starship' },
  { id: 'windsurf', displayName: 'Windsurf' },
  { id: 'obs-studio', displayName: 'OBS Studio' },
];

const MOCK_CONFIG_MAP = {
  'Microsoft.VisualStudioCode': 'Visual Studio Code',
  'Git.Git': 'Git',
  'Microsoft.WindowsTerminal': 'Windows Terminal',
  'Microsoft.PowerShell': 'PowerShell',
  'Microsoft.PowerToys': 'PowerToys',
  'Starship.Starship': 'Starship',
  'Codeium.Windsurf': 'Windsurf',
  'OBSProject.OBSStudio': 'OBS Studio',
};

// Capture flow mock apps (for scanning state)
const CAPTURE_APPS = [
  { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code' },
  { id: 'Git.Git', name: 'Git' },
  { id: 'Google.Chrome', name: 'Google Chrome' },
  { id: 'Mozilla.Firefox', name: 'Firefox' },
  { id: 'Microsoft.WindowsTerminal', name: 'Windows Terminal' },
  { id: 'Microsoft.PowerShell', name: 'PowerShell' },
  { id: '7zip.7zip', name: '7-Zip' },
  { id: 'Notepad++.Notepad++', name: 'Notepad++' },
  { id: 'VideoLAN.VLC', name: 'VLC Media Player' },
  { id: 'Discord.Discord', name: 'Discord' },
  { id: 'Spotify.Spotify', name: 'Spotify' },
  { id: 'SlackTechnologies.Slack', name: 'Slack' },
  { id: 'Docker.DockerDesktop', name: 'Docker Desktop' },
  { id: 'Bitwarden.Bitwarden', name: 'Bitwarden' },
  { id: 'Obsidian.Obsidian', name: 'Obsidian' },
  { id: 'Brave.Brave', name: 'Brave' },
  { id: 'Postman.Postman', name: 'Postman' },
  { id: 'GIMP.GIMP', name: 'GIMP' },
  { id: 'OBSProject.OBSStudio', name: 'OBS Studio' },
  { id: 'Figma.Figma', name: 'Figma' },
];

// ── Tauri + Engine Mock ───────────────────────────────────────────

async function installMocks(context, { apps, restoreModules, configModuleMap, captureApps, captureDelayMs }) {
  const profilePath = 'C:\\test\\profiles\\work-laptop.jsonc';
  const metaPath = 'C:\\test\\profiles\\work-laptop.meta.json';

  await context.addInitScript(() => { (window).__ENDSTATE_E2E_MODE__ = true; });

  // Tauri bridge mock
  await context.addInitScript(({ profilePath, metaPath }) => {
    const profileFiles = new Set([profilePath, metaPath]);
    const fileContents = new Map();
    fileContents.set(metaPath, JSON.stringify({ displayName: 'Work Laptop' }));
    fileContents.set(profilePath, JSON.stringify({ version: 1, apps: [] }));
    (window).__test_profileFiles = profileFiles;
    (window).__test_fileContents = fileContents;
    (window).__test_operations = [];
    (window).__test_writeFileCalls = [];
    (window).__test_deleteFileCalls = [];
    (window).__test_renameFileCalls = [];
    const pluginStoreData = new Map();
    const handlers = {
      ensure_dir: () => null, read_dir: () => [],
      list_manifest_files: () => Array.from(profileFiles),
      get_default_profiles_directory: () => 'C:\\test\\profiles',
      get_capture_cache_directory: () => 'C:\\test\\cache',
      read_text_file: (a) => fileContents.get(a?.path) || '{"version": 1, "apps": []}',
      check_file_exists: (a) => profileFiles.has(a?.path),
      validate_profile: () => ({ valid: true, summary: { name: 'work-laptop', version: 1, appCount: 72 } }),
      delete_file: () => null, delete_file_silent: () => null, rename_file: () => null,
      write_text_file: (a) => { if (a?.path) { profileFiles.add(a.path); fileContents.set(a.path, a.content); } return null; },
      copy_file: () => null, cleanup_capture_cache: () => null, show_file_dialog: () => null,
      'plugin:store|load': () => { const r = {}; pluginStoreData.forEach((v,k) => { r[k] = v; }); return r; },
      'plugin:store|save': () => null,
      'plugin:store|get': (a) => pluginStoreData.get(a?.key) ?? null,
      'plugin:store|set': (a) => { if (a?.key !== undefined) pluginStoreData.set(a.key, a.value); return null; },
      'plugin:store|delete': (a) => { if (a?.key !== undefined) pluginStoreData.delete(a.key); return null; },
      'plugin:store|clear': () => { pluginStoreData.clear(); return null; },
      'plugin:store|keys': () => Array.from(pluginStoreData.keys()),
      'plugin:store|values': () => Array.from(pluginStoreData.values()),
      'plugin:store|entries': () => Array.from(pluginStoreData.entries()),
      'plugin:store|length': () => pluginStoreData.size,
      'plugin:store|has': (a) => pluginStoreData.has(a?.key),
    };
    (window).__TAURI__ = {
      core: { invoke: async (cmd, args) => handlers[cmd] ? handlers[cmd](args) : null },
      invoke: async (cmd, args) => handlers[cmd] ? handlers[cmd](args) : null,
      event: { listen: async () => () => {} },
    };
  }, { profilePath, metaPath });

  // Mock engine
  await context.addInitScript(({ apps, restoreModules, configModuleMap, captureApps, captureDelayMs }) => {
    const toInstallCount = apps.filter(a => a.status === 'to_install').length;
    const presentCount = apps.filter(a => a.status === 'present').length;

    // Convert to_install → installed for apply (non-dry-run)
    const applyApps = apps.map(a => a.status === 'to_install'
      ? { ...a, status: 'installed', reason: 'installed' }
      : a
    );

    // Restore items for apply with --enable-restore
    const restoreItems = [
      { id: 'settings.json', module: 'vscode', restorer: 'file', source: 'bundle://vscode/settings.json', target: '%APPDATA%/Code/User/settings.json', status: 'restored', reason: null, backupPath: null, targetExisted: true },
      { id: 'keybindings.json', module: 'vscode', restorer: 'file', source: 'bundle://vscode/keybindings.json', target: '%APPDATA%/Code/User/keybindings.json', status: 'restored', reason: null, backupPath: null, targetExisted: true },
      { id: '.gitconfig', module: 'git', restorer: 'file', source: 'bundle://git/.gitconfig', target: '%USERPROFILE%/.gitconfig', status: 'restored', reason: null, backupPath: null, targetExisted: true },
      { id: 'settings.json', module: 'windows-terminal', restorer: 'file', source: 'bundle://windows-terminal/settings.json', target: '%LOCALAPPDATA%/Packages/.../settings.json', status: 'restored', reason: null, backupPath: null, targetExisted: false },
      { id: 'profile.ps1', module: 'powershell', restorer: 'file', source: 'bundle://powershell/profile.ps1', target: '%USERPROFILE%/Documents/PowerShell/profile.ps1', status: 'restored', reason: null, backupPath: null, targetExisted: true },
      { id: 'settings.json', module: 'powertoys', restorer: 'file', source: 'bundle://powertoys/settings.json', target: '%LOCALAPPDATA%/Microsoft/PowerToys/settings.json', status: 'restored', reason: null, backupPath: null, targetExisted: false },
      { id: 'starship.toml', module: 'starship', restorer: 'file', source: 'bundle://starship/starship.toml', target: '%USERPROFILE%/.config/starship.toml', status: 'restored', reason: null, backupPath: null, targetExisted: true },
      { id: 'settings.json', module: 'windsurf', restorer: 'file', source: 'bundle://windsurf/settings.json', target: '%APPDATA%/Windsurf/User/settings.json', status: 'restored', reason: null, backupPath: null, targetExisted: false },
    ];

    const mockEngine = {
      runEndstateStreaming: async (_settings, command, args, onEvent, options) => {
        if (command === 'capabilities') {
          const e = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'capabilities', success: true, data: { version: '1.5.2', drivers: ['winget'], features: ['restore'], commands: ['capture', 'apply', 'verify'] }, error: null };
          return { exitCode: 0, stdout: JSON.stringify(e), stderr: '', envelope: e, ndjsonEvents: [] };
        }

        if (command === 'apply') {
          const isDryRun = args.includes('--dry-run');
          const hasRestore = args.includes('--enable-restore');
          const sourceApps = isDryRun ? apps : applyApps;
          const installedCount = isDryRun ? toInstallCount : toInstallCount;
          const installedStatus = isDryRun ? toInstallCount : toInstallCount;

          if (options?.onNdjsonEvent) {
            options.onNdjsonEvent({ event: 'phase', phase: 'start', command: 'apply', timestamp: new Date().toISOString() });
            for (const app of sourceApps) {
              options.onNdjsonEvent({ event: 'item', id: app.id, name: app.name, driver: app.driver, status: app.status, reason: app.reason });
              await new Promise(r => setTimeout(r, 5));
            }
            // Restore items (for non-dry-run with --enable-restore)
            if (!isDryRun && hasRestore) {
              for (const ri of restoreItems) {
                options.onNdjsonEvent({ event: 'restore-item', ...ri });
                await new Promise(r => setTimeout(r, 5));
              }
            }
            options.onNdjsonEvent({ event: 'phase', phase: 'end', command: 'apply', timestamp: new Date().toISOString() });
          }

          const envelope = {
            schemaVersion: '1.0', cliVersion: '1.5.2', command: 'apply', success: true,
            data: {
              counts: {
                installed: isDryRun ? toInstallCount : toInstallCount,
                alreadyInstalled: presentCount,
                failed: 0, skippedFiltered: 0
              },
              actions: sourceApps.map(a => ({ id: a.id, name: a.name, driver: a.driver, status: a.status, reason: a.reason })),
              restoreModulesAvailable: restoreModules,
              configModuleMap: configModuleMap,
              ...((!isDryRun && hasRestore) ? {
                restoreSummary: { total: restoreItems.length, restored: restoreItems.length, skipped: 0, failed: 0, backupLocation: null },
                restoreItems: restoreItems,
                restoreJournalFile: 'C:\\test\\profiles\\runs\\restore-journal.json',
              } : {}),
            },
            error: null,
          };

          return { exitCode: 0, stdout: JSON.stringify(envelope), stderr: '', envelope, ndjsonEvents: [] };
        }

        // Capture command — with configurable delay for mid-scan screenshot
        if (command === 'capture') {
          if (options?.onNdjsonEvent) {
            options.onNdjsonEvent({ event: 'phase', phase: 'start', command: 'capture', timestamp: new Date().toISOString() });
            for (const app of captureApps) {
              options.onNdjsonEvent({ event: 'item', id: app.id, name: app.name, driver: 'winget', status: 'detected', reason: 'detected' });
              await new Promise(r => setTimeout(r, captureDelayMs));
            }
            options.onNdjsonEvent({ event: 'phase', phase: 'end', command: 'capture', timestamp: new Date().toISOString() });
          }
          const envelope = {
            schemaVersion: '1.0', cliVersion: '1.5.2', command: 'capture', success: true,
            data: {
              outputPath: 'C:\\test\\profiles\\captured.jsonc', isExample: null, sanitized: false,
              counts: { totalFound: captureApps.length, included: captureApps.length, skipped: 0, filteredRuntimes: 0, filteredStoreApps: 0, sensitiveExcludedCount: 0 },
              appsIncluded: captureApps.map(a => ({ id: a.id, source: 'winget' })),
            },
            error: null,
          };
          return { exitCode: 0, stdout: JSON.stringify(envelope), stderr: '', envelope, ndjsonEvents: [] };
        }

        const re = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'report', success: true, data: { hasState: false }, error: null };
        return { exitCode: 0, stdout: JSON.stringify(re), stderr: '', envelope: re, ndjsonEvents: [] };
      },
      runEndstateOnce: async (_settings, command, args) => {
        if (command === 'capabilities') {
          const e = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'capabilities', success: true, data: { version: '1.5.2', drivers: ['winget'], features: ['restore'], commands: ['capture', 'apply', 'verify'] }, error: null };
          return { success: true, envelope: e, stdout: JSON.stringify(e), stderr: '', exitCode: 0 };
        }
        if (command === 'report') {
          const e = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'report', success: true, data: { hasState: false }, error: null };
          return { success: true, envelope: e, stdout: JSON.stringify(e), stderr: '', exitCode: 0 };
        }
        const r = await mockEngine.runEndstateStreaming(_settings, command, args);
        return { success: true, envelope: r.envelope, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
      },
    };
    (window).__ENDSTATE_MOCK_ENGINE__ = mockEngine;
  }, { apps, restoreModules, configModuleMap, captureApps, captureDelayMs });
}

// ── Screenshots ───────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- 04. Setup preview with "Install apps and restore settings" selected ---
  console.log('1/3  Capturing setup restore preview...');
  const restoreCtx = await browser.newContext({
    viewport: { width: 840, height: 880 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  await installMocks(restoreCtx, { apps: MOCK_APPS, restoreModules: MOCK_RESTORE_MODULES, configModuleMap: MOCK_CONFIG_MAP, captureApps: CAPTURE_APPS, captureDelayMs: 5 });
  const restorePage = await restoreCtx.newPage();
  await restorePage.goto(BASE, { waitUntil: 'networkidle' });
  await restorePage.waitForSelector('[data-testid="intent-setup"]', { timeout: 10000 });
  await restorePage.click('[data-testid="intent-setup"]');
  await restorePage.waitForSelector('[data-testid="setup-flow"]', { timeout: 5000 });
  const selectBtn1 = restorePage.locator('[data-testid="setup-flow"] button', { hasText: 'Select' }).first();
  await selectBtn1.waitFor({ timeout: 10000 });
  await selectBtn1.click();
  await restorePage.locator('text=Preview complete').waitFor({ timeout: 30000 });
  await restorePage.waitForTimeout(400);
  // Click "Install apps and restore settings" radio
  await restorePage.click('text=Install apps and restore settings');
  await restorePage.waitForTimeout(500);
  await restorePage.screenshot({ path: join(outDir, '04-setup-restore-preview.png') });
  console.log('     -> screenshots/extras/04-setup-restore-preview.png');
  await restoreCtx.close();

  // --- 05. Apply complete with settings restored ---
  console.log('2/3  Capturing apply complete with settings restored...');
  const applyCtx = await browser.newContext({
    viewport: { width: 840, height: 820 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  await installMocks(applyCtx, { apps: MOCK_APPS, restoreModules: MOCK_RESTORE_MODULES, configModuleMap: MOCK_CONFIG_MAP, captureApps: CAPTURE_APPS, captureDelayMs: 5 });
  const applyPage = await applyCtx.newPage();
  await applyPage.goto(BASE, { waitUntil: 'networkidle' });
  await applyPage.waitForSelector('[data-testid="intent-setup"]', { timeout: 10000 });
  await applyPage.click('[data-testid="intent-setup"]');
  await applyPage.waitForSelector('[data-testid="setup-flow"]', { timeout: 5000 });
  const selectBtn2 = applyPage.locator('[data-testid="setup-flow"] button', { hasText: 'Select' }).first();
  await selectBtn2.waitFor({ timeout: 10000 });
  await selectBtn2.click();
  await applyPage.locator('text=Preview complete').waitFor({ timeout: 30000 });
  await applyPage.waitForTimeout(300);
  // Select "Install apps and restore settings"
  await applyPage.click('text=Install apps and restore settings');
  await applyPage.waitForTimeout(300);
  // Click "Apply changes"
  const applyBtn = applyPage.locator('button', { hasText: 'Apply changes' });
  await applyBtn.waitFor({ timeout: 5000 });
  await applyBtn.click();
  // Wait for apply to complete
  const applyDone = applyPage.locator('text=Setup complete');
  await applyDone.waitFor({ timeout: 60000 });
  await applyPage.waitForTimeout(600);
  await applyPage.screenshot({ path: join(outDir, '05-apply-done-restored.png') });
  console.log('     -> screenshots/extras/05-apply-done-restored.png');
  await applyCtx.close();

  // --- 06. Save flow scanning in progress ---
  console.log('3/3  Capturing save flow scanning...');
  const scanCtx = await browser.newContext({
    viewport: { width: 840, height: 620 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  // Use slow capture delay so we can screenshot mid-scan
  await installMocks(scanCtx, { apps: MOCK_APPS, restoreModules: MOCK_RESTORE_MODULES, configModuleMap: MOCK_CONFIG_MAP, captureApps: CAPTURE_APPS, captureDelayMs: 400 });
  const scanPage = await scanCtx.newPage();
  await scanPage.goto(BASE, { waitUntil: 'networkidle' });
  await scanPage.waitForSelector('[data-testid="intent-save"]', { timeout: 10000 });
  await scanPage.click('[data-testid="intent-save"]');
  await scanPage.waitForSelector('[data-testid="save-flow-start-scan"]', { timeout: 5000 });
  await scanPage.waitForTimeout(300);
  await scanPage.click('[data-testid="save-flow-start-scan"]');
  // Wait a beat for some events to stream in, then screenshot mid-scan
  await scanPage.waitForTimeout(3000);
  await scanPage.screenshot({ path: join(outDir, '06-capture-scanning.png') });
  console.log('     -> screenshots/extras/06-capture-scanning.png');
  await scanCtx.close();

  await browser.close();
  console.log('\nDone! Extra screenshots saved to screenshots/extras/');
}

main().catch((err) => {
  console.error('Extra screenshot capture failed:', err.message);
  process.exit(1);
});

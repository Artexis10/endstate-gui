/**
 * Capture high-quality marketing screenshots using the real UI with mock data.
 * Run: node scripts/capture-screenshots.mjs
 * Requires: dev server running at http://127.0.0.1:1420
 *
 * Screenshots:
 *   01-landing.png       — Main landing screen (Tauri mock suppresses errors)
 *   02-save-results.png  — Save flow done state (harness)
 *   03-setup-results.png — Setup flow preview-done state (real UI + mock engine)
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'screenshots');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://127.0.0.1:1420';
const SCALE = 2; // 2x retina

// ── Mock Data ─────────────────────────────────────────────────────
// 72 realistic Windows apps: 3 to_install, 69 present
// Matches the original screenshot's counts exactly.

const MOCK_APPS = [
  // 3 apps to install
  { id: 'Anthropic.ClaudeCode', name: 'Claude Code', status: 'to_install', reason: null, driver: 'winget' },
  { id: 'Hashicorp.Terraform', name: 'Terraform', status: 'to_install', reason: null, driver: 'winget' },
  { id: 'Pulumi.Pulumi', name: 'Pulumi', status: 'to_install', reason: null, driver: 'winget' },
  // 69 already present (alphabetical, realistic winget IDs)
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

// 8 apps with settings (config modules)
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

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Install Tauri bridge mock + custom mock engine on a Playwright context.
 * This gives us: profile discovery, file operations, and a realistic preview.
 */
async function installMarketingMocks(context, { apps, restoreModules, configModuleMap }) {
  const profilePath = 'C:\\test\\profiles\\work-laptop.jsonc';
  const metaPath = 'C:\\test\\profiles\\work-laptop.meta.json';

  // 1. E2E mode flag
  await context.addInitScript(() => {
    (window).__ENDSTATE_E2E_MODE__ = true;
  });

  // 2. Tauri bridge mock (profile discovery, file I/O)
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
      ensure_dir: () => null,
      read_dir: () => [],
      list_manifest_files: () => Array.from(profileFiles),
      get_default_profiles_directory: () => 'C:\\test\\profiles',
      get_capture_cache_directory: () => 'C:\\test\\cache',
      read_text_file: (args) => fileContents.get(args?.path) || '{"version": 1, "apps": []}',
      check_file_exists: (args) => profileFiles.has(args?.path),
      validate_profile: () => ({ valid: true, summary: { name: 'work-laptop', version: 1, appCount: 72 } }),
      delete_file: () => null,
      delete_file_silent: () => null,
      rename_file: () => null,
      write_text_file: (args) => { if (args?.path) { profileFiles.add(args.path); fileContents.set(args.path, args.content); } return null; },
      copy_file: () => null,
      cleanup_capture_cache: () => null,
      show_file_dialog: () => null,
      'plugin:store|load': () => { const r = {}; pluginStoreData.forEach((v, k) => { r[k] = v; }); return r; },
      'plugin:store|save': () => null,
      'plugin:store|get': (args) => pluginStoreData.get(args?.key) ?? null,
      'plugin:store|set': (args) => { if (args?.key !== undefined) pluginStoreData.set(args.key, args.value); return null; },
      'plugin:store|delete': (args) => { if (args?.key !== undefined) pluginStoreData.delete(args.key); return null; },
      'plugin:store|clear': () => { pluginStoreData.clear(); return null; },
      'plugin:store|keys': () => Array.from(pluginStoreData.keys()),
      'plugin:store|values': () => Array.from(pluginStoreData.values()),
      'plugin:store|entries': () => Array.from(pluginStoreData.entries()),
      'plugin:store|length': () => pluginStoreData.size,
      'plugin:store|has': (args) => pluginStoreData.has(args?.key),
    };

    (window).__TAURI__ = {
      core: { invoke: async (cmd, args) => {
        if (handlers[cmd]) return handlers[cmd](args);
        console.warn('[SCREENSHOT MOCK] unhandled invoke:', cmd);
        return null;
      }},
      invoke: async (cmd, args) => {
        if (handlers[cmd]) return handlers[cmd](args);
        console.warn('[SCREENSHOT MOCK] unhandled invoke:', cmd);
        return null;
      },
      event: { listen: async () => () => {} },
    };
  }, { profilePath, metaPath });

  // 3. Custom mock engine (realistic preview data)
  await context.addInitScript(({ apps, restoreModules, configModuleMap }) => {
    const toInstallCount = apps.filter(a => a.status === 'to_install').length;
    const presentCount = apps.filter(a => a.status === 'present').length;

    const mockEngine = {
      // runEngineStreaming shape: { envelope, exitCode, stdout, stderr, ndjsonEvents }
      runEndstateStreaming: async (_settings, command, args, onEvent, options) => {
        // Capabilities
        if (command === 'capabilities') {
          const envelope = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'capabilities', success: true, data: { version: '1.5.2', drivers: ['winget'], features: ['restore'], commands: ['capture', 'apply', 'verify'] }, error: null };
          return { exitCode: 0, stdout: JSON.stringify(envelope), stderr: '', envelope, ndjsonEvents: [] };
        }

        // Preview (apply --dry-run)
        if (command === 'apply') {
          // Emit streaming events for live activity
          if (options?.onNdjsonEvent) {
            options.onNdjsonEvent({ event: 'phase', phase: 'start', command: 'apply', timestamp: new Date().toISOString() });
            for (const app of apps) {
              options.onNdjsonEvent({
                event: 'item', id: app.id, name: app.name,
                driver: app.driver, status: app.status,
                reason: app.reason,
              });
              await new Promise(r => setTimeout(r, 5));
            }
            options.onNdjsonEvent({ event: 'phase', phase: 'end', command: 'apply', timestamp: new Date().toISOString() });
          }

          const envelope = {
            schemaVersion: '1.0', cliVersion: '1.5.2', command: 'apply', success: true,
            data: {
              counts: { installed: toInstallCount, alreadyInstalled: presentCount, failed: 0, skipped: 0 },
              actions: apps.map(a => ({ id: a.id, name: a.name, driver: a.driver, status: a.status, reason: a.reason })),
              restoreModulesAvailable: restoreModules,
              configModuleMap: configModuleMap,
            },
            error: null,
          };

          return { exitCode: 0, stdout: JSON.stringify(envelope), stderr: '', envelope, ndjsonEvents: [] };
        }

        // Report (fallback)
        const reportEnvelope = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'report', success: true, data: { hasState: false }, error: null };
        return { exitCode: 0, stdout: JSON.stringify(reportEnvelope), stderr: '', envelope: reportEnvelope, ndjsonEvents: [] };
      },
      // runEndstateOnce shape: { success, envelope, stdout, stderr, exitCode }
      runEndstateOnce: async (_settings, command, args) => {
        if (command === 'capabilities') {
          const envelope = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'capabilities', success: true, data: { version: '1.5.2', drivers: ['winget'], features: ['restore'], commands: ['capture', 'apply', 'verify'] }, error: null };
          return { success: true, envelope, stdout: JSON.stringify(envelope), stderr: '', exitCode: 0 };
        }
        if (command === 'report') {
          const envelope = { schemaVersion: '1.0', cliVersion: '1.5.2', command: 'report', success: true, data: { hasState: false }, error: null };
          return { success: true, envelope, stdout: JSON.stringify(envelope), stderr: '', exitCode: 0 };
        }
        // Fallback to streaming for other commands
        const result = await mockEngine.runEndstateStreaming(_settings, command, args);
        return { success: true, envelope: result.envelope, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
      },
    };

    (window).__ENDSTATE_MOCK_ENGINE__ = mockEngine;
  }, { apps, restoreModules, configModuleMap });
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- 1. Landing Page ---
  console.log('1/3  Capturing landing page...');
  const landingCtx = await browser.newContext({
    viewport: { width: 840, height: 620 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  await installMarketingMocks(landingCtx, { apps: MOCK_APPS, restoreModules: MOCK_RESTORE_MODULES, configModuleMap: MOCK_CONFIG_MAP });
  const landingPage = await landingCtx.newPage();
  await landingPage.goto(BASE, { waitUntil: 'networkidle' });
  await landingPage.waitForSelector('[data-testid="intent-save"]', { timeout: 10000 });
  await landingPage.waitForTimeout(600);
  await landingPage.screenshot({ path: join(outDir, '01-landing.png') });
  console.log('     -> screenshots/01-landing.png');
  await landingCtx.close();

  // --- 2. Save Flow Results (via screenshot harness — harness is good for this one) ---
  console.log('2/3  Capturing Save flow results...');
  const saveCtx = await browser.newContext({
    viewport: { width: 840, height: 740 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  const savePage = await saveCtx.newPage();
  await savePage.goto(`${BASE}/?screenshots=1`, { waitUntil: 'networkidle' });
  // Hide the harness switcher bar
  await savePage.evaluate(() => {
    const bar = document.querySelector('.fixed.top-0');
    if (bar) bar.style.display = 'none';
    const content = document.querySelector('.pt-14');
    if (content) content.classList.replace('pt-14', 'pt-8');
  });
  await savePage.waitForTimeout(300);
  await savePage.screenshot({ path: join(outDir, '02-save-results.png') });
  console.log('     -> screenshots/02-save-results.png');
  await saveCtx.close();

  // --- 3. Setup Flow Preview Results (real UI + mock engine) ---
  console.log('3/3  Capturing Setup flow preview results...');
  const setupCtx = await browser.newContext({
    viewport: { width: 840, height: 820 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  await installMarketingMocks(setupCtx, { apps: MOCK_APPS, restoreModules: MOCK_RESTORE_MODULES, configModuleMap: MOCK_CONFIG_MAP });
  const setupPage = await setupCtx.newPage();
  await setupPage.goto(BASE, { waitUntil: 'networkidle' });

  // Click "Set up this computer"
  await setupPage.waitForSelector('[data-testid="intent-setup"]', { timeout: 10000 });
  await setupPage.click('[data-testid="intent-setup"]');

  // Wait for the setup flow and the profile card to appear
  await setupPage.waitForSelector('[data-testid="setup-flow"]', { timeout: 5000 });
  await setupPage.waitForTimeout(300);

  // Click "Select" on the Work Laptop profile
  const selectBtn = setupPage.locator('[data-testid="setup-flow"] button', { hasText: 'Select' }).first();
  await selectBtn.waitFor({ timeout: 10000 });
  await selectBtn.click();

  // Wait for preview to complete
  const previewDone = setupPage.locator('[data-testid="setup-flow"]').locator('text=Preview complete');
  await previewDone.waitFor({ timeout: 30000 });
  await setupPage.waitForTimeout(600);

  await setupPage.screenshot({ path: join(outDir, '03-setup-results-new.png') });
  console.log('     -> screenshots/03-setup-results-new.png (compare before replacing)');
  await setupCtx.close();

  await browser.close();
  console.log('\nDone! Screenshots saved to screenshots/');
  console.log('NOTE: 03 saved as -new.png for comparison. Replace manually when satisfied.');
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err.message);
  process.exit(1);
});

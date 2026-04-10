/**
 * Screenshot Harness — TEMPORARY FILE
 * 
 * Renders SaveFlow "done" and SetupFlow "apply-done" states with mock data
 * for pixel-perfect marketing screenshots. Delete after use.
 * 
 * Access via: ?screenshots=1
 */

import { useState } from 'react';
import { ArrowLeft, HardDrive, Download, CheckCircle2, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  type StatusKey,
  type SemanticColor,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';

// ── Mock Data ──────────────────────────────────────────────────────

const SAVE_APPS = [
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
  { id: 'Microsoft.PowerToys', name: 'PowerToys' },
  { id: 'Docker.DockerDesktop', name: 'Docker Desktop' },
  { id: 'Postman.Postman', name: 'Postman' },
  { id: 'WinSCP.WinSCP', name: 'WinSCP' },
  { id: 'PuTTY.PuTTY', name: 'PuTTY' },
  { id: 'OBSProject.OBSStudio', name: 'OBS Studio' },
  { id: 'GIMP.GIMP', name: 'GIMP' },
  { id: 'Bitwarden.Bitwarden', name: 'Bitwarden' },
  { id: 'Notion.Notion', name: 'Notion' },
  { id: 'Obsidian.Obsidian', name: 'Obsidian' },
  { id: 'Valve.Steam', name: 'Steam' },
  { id: 'BurntSushi.ripgrep.MSVC', name: 'ripgrep' },
  { id: 'sharkdp.fd', name: 'fd' },
  { id: 'junegunn.fzf', name: 'fzf' },
  { id: 'ajeetdsouza.zoxide', name: 'zoxide' },
  { id: 'WinMerge.WinMerge', name: 'WinMerge' },
  { id: 'Audacity.Audacity', name: 'Audacity' },
  { id: 'KeePassXCTeam.KeePassXC', name: 'KeePassXC' },
  { id: 'Transmission.Transmission', name: 'Transmission' },
  { id: 'Figma.Figma', name: 'Figma' },
];

// Apps with captured settings (winget IDs)
const SAVE_SETTINGS_IDS = new Set([
  'Microsoft.VisualStudioCode',
  'Git.Git',
  'Microsoft.WindowsTerminal',
  'Microsoft.PowerShell',
  'Microsoft.PowerToys',
]);

// Setup flow mock data — preview-done state
interface MockAppEvent {
  app: string;
  name: string;
  statusKey: StatusKey;
  reason?: string;
}

// ── Harness Components ─────────────────────────────────────────────

function SaveScreenshot() {
  const settingsCount = SAVE_SETTINGS_IDS.size;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Back navigation */}
      <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-blue-500/10">
          <HardDrive className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Save this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scan your apps and settings, then save everything as a portable file
          </p>
        </div>
      </div>

      {/* Done state */}
      <div className="space-y-4">
        <Card className="border-l-2 border-l-blue-500/50">
          <CardContent className="py-6 px-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Scan complete</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Found {SAVE_APPS.length} apps &middot; {settingsCount} settings captured
                </p>
              </div>
            </div>

            {/* Filter chips + app list */}
            <div className="mt-3 border-t pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}>
                  {SAVE_APPS.length} apps
                </button>
                <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                  {settingsCount} settings
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {SAVE_APPS.map((app) => {
                  const colors = getColorClasses('detected');
                  const hasSettings = SAVE_SETTINGS_IDS.has(app.id);
                  return (
                    <div key={app.id} className="flex items-center gap-2 text-xs pt-0.5">
                      <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>DETECTED</span>
                      <span className="w-4 flex-shrink-0 flex justify-center">
                        {hasSettings && (
                          <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                        )}
                      </span>
                      <span className="truncate">{app.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white ring-blue-600/30 hover:ring-blue-600/50">
                <Save className="h-4 w-4 mr-2" />
                Save file
              </Button>
              <Button variant="ghost">
                Scan again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SetupScreenshot() {
  const toInstallCount = 3;
  const presentCount = 69;
  const settingsCount = 8;
  const totalApps = toInstallCount + presentCount;

  // Visible app list matching original screenshot layout
  const previewApps: MockAppEvent[] = [
    { app: '7zip.7zip', name: '7-Zip 25.01 (x64)', statusKey: 'present' },
    { app: 'Adobe.CreativeCloud', name: 'Adobe Creative Cloud', statusKey: 'present' },
    { app: 'Cursor.Cursor', name: 'Cursor (User)', statusKey: 'present' },
    { app: 'Apple.MobileDeviceSupport', name: 'Apple Mobile Device Support', statusKey: 'present' },
    { app: 'Apple.SoftwareUpdate', name: 'Apple Software Update', statusKey: 'present' },
    { app: 'Bitwarden.Bitwarden', name: 'Bitwarden', statusKey: 'present' },
    { app: 'Brave.Brave', name: 'Brave', statusKey: 'present' },
    { app: 'BurntSushi.ripgrep.MSVC', name: 'RipGrep MSVC', statusKey: 'present' },
    { app: 'Bytedance.CapCut', name: 'CapCut', statusKey: 'present' },
    { app: 'Cloudflare.cloudflared', name: 'cloudflared', statusKey: 'present' },
    { app: 'Codeium.Windsurf', name: 'Windsurf (User)', statusKey: 'present' },
    { app: 'Cryptomator.Cryptomator', name: 'Cryptomator', statusKey: 'present' },
  ];

  // Apps with settings (gear icon)
  const settingsApps = new Set(['Codeium.Windsurf']);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Back navigation */}
      <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profiles
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-green-500/10">
          <Download className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Set up this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setting up from Work Laptop
          </p>
        </div>
      </div>

      {/* Preview-done state */}
      <Card className="border-l-2 border-l-green-500/50">
        <CardContent className="py-6 px-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium">Preview complete</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {toInstallCount} to install, {presentCount} already present &middot; {settingsCount} settings included
              </p>
            </div>
          </div>

          {/* Filter chips + app list */}
          <div className="mt-3 border-t pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}>
                {totalApps} apps
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('action').bg} ${getColorClasses('action').text}`}>
                {toInstallCount} to install
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text} opacity-50`}>
                {presentCount} present
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                {settingsCount} settings
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {previewApps.map((event, i) => {
                const uiStatus = getPhaseAwareStatusForEvent({ statusKey: event.statusKey, phase: 'preview', reason: event.reason });
                const colors = getColorClasses(uiStatus.color);
                const hasSettings = settingsApps.has(event.app);
                return (
                  <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                    <span className={`w-16 flex-shrink-0 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                    <span className="w-4 flex-shrink-0 flex justify-center">
                      {hasSettings && (
                        <Settings2 className={`h-3 w-3 ${getColorClasses('success').text}`} />
                      )}
                    </span>
                    <span className="truncate">{event.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings radio group */}
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-3">This profile includes settings for {settingsCount} apps</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <span className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </span>
                Install apps only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
                <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />
                Install apps and restore settings
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button className="bg-green-600 hover:bg-green-700 text-white ring-green-600/30 hover:ring-green-600/50">
              Apply changes
            </Button>
            <Button variant="ghost">
              Back to profiles
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Harness ──────────────────────────────────────────────────

export function ScreenshotHarness() {
  const [view, setView] = useState<'save' | 'setup'>('save');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Switcher bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-2 flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium">SCREENSHOT HARNESS</span>
        <Button
          variant={view === 'save' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('save')}
        >
          Save Flow
        </Button>
        <Button
          variant={view === 'setup' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('setup')}
        >
          Setup Flow
        </Button>
      </div>

      {/* Content with top padding for switcher */}
      <div className="pt-14 px-8 pb-8 max-w-2xl mx-auto">
        {view === 'save' ? <SaveScreenshot /> : <SetupScreenshot />}
      </div>
    </div>
  );
}

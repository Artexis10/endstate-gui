/**
 * Screenshot Harness — TEMPORARY FILE
 * 
 * Renders SaveFlow "done" and SetupFlow "apply-done" states with mock data
 * for pixel-perfect marketing screenshots. Delete after use.
 * 
 * Access via: ?screenshots=1
 */

import { useState } from 'react';
import { ArrowLeft, HardDrive, Download, CheckCircle2, Save, Settings2, XCircle } from 'lucide-react';
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

// Setup flow mock data — apply-done state
interface MockAppEvent {
  app: string;
  name: string;
  statusKey: StatusKey;
  reason?: string;
}

const SETUP_EVENTS: MockAppEvent[] = [
  { app: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', statusKey: 'installed' },
  { app: 'Git.Git', name: 'Git', statusKey: 'installed' },
  { app: 'Google.Chrome', name: 'Google Chrome', statusKey: 'present' },
  { app: 'Mozilla.Firefox', name: 'Firefox', statusKey: 'installed' },
  { app: 'Microsoft.WindowsTerminal', name: 'Windows Terminal', statusKey: 'present' },
  { app: 'Microsoft.PowerShell', name: 'PowerShell', statusKey: 'present' },
  { app: '7zip.7zip', name: '7-Zip', statusKey: 'installed' },
  { app: 'Notepad++.Notepad++', name: 'Notepad++', statusKey: 'installed' },
  { app: 'VideoLAN.VLC', name: 'VLC Media Player', statusKey: 'present' },
  { app: 'Discord.Discord', name: 'Discord', statusKey: 'present' },
  { app: 'Spotify.Spotify', name: 'Spotify', statusKey: 'present' },
  { app: 'SlackTechnologies.Slack', name: 'Slack', statusKey: 'installed' },
  { app: 'Microsoft.PowerToys', name: 'PowerToys', statusKey: 'installed' },
  { app: 'Docker.DockerDesktop', name: 'Docker Desktop', statusKey: 'installed' },
  { app: 'Postman.Postman', name: 'Postman', statusKey: 'present' },
  { app: 'WinSCP.WinSCP', name: 'WinSCP', statusKey: 'present' },
  { app: 'PuTTY.PuTTY', name: 'PuTTY', statusKey: 'present' },
  { app: 'OBSProject.OBSStudio', name: 'OBS Studio', statusKey: 'present' },
  { app: 'GIMP.GIMP', name: 'GIMP', statusKey: 'present' },
  { app: 'Bitwarden.Bitwarden', name: 'Bitwarden', statusKey: 'present' },
  { app: 'Notion.Notion', name: 'Notion', statusKey: 'present' },
  { app: 'Obsidian.Obsidian', name: 'Obsidian', statusKey: 'present' },
  { app: 'Valve.Steam', name: 'Steam', statusKey: 'present' },
  { app: 'BurntSushi.ripgrep.MSVC', name: 'ripgrep', statusKey: 'present' },
  { app: 'sharkdp.fd', name: 'fd', statusKey: 'present' },
  { app: 'junegunn.fzf', name: 'fzf', statusKey: 'present' },
  { app: 'ajeetdsouza.zoxide', name: 'zoxide', statusKey: 'present' },
  { app: 'WinMerge.WinMerge', name: 'WinMerge', statusKey: 'present' },
];

const SETUP_CONFIG_MAP: Record<string, string> = {
  'Microsoft.VisualStudioCode': 'vscode',
  'Git.Git': 'git',
  'Microsoft.WindowsTerminal': 'windows-terminal',
  'Microsoft.PowerShell': 'powershell',
  'Microsoft.PowerToys': 'powertoys',
};

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
  const installedCount = SETUP_EVENTS.filter(e => e.statusKey === 'installed').length;
  const presentCount = SETUP_EVENTS.filter(e => e.statusKey === 'present').length;
  const failedCount = 0;
  const skippedCount = 0;
  const configsRestored = 5;
  const totalApps = installedCount + presentCount;

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

      {/* Apply-done state */}
      <Card className="border-l-2 border-l-green-500/50">
        <CardContent className="py-6 px-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium">Setup complete</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {installedCount} installed, {presentCount} already present &middot; {configsRestored} settings restored
              </p>
            </div>
          </div>

          {/* Filter chips + app list */}
          <div className="mt-3 border-t pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}>
                {totalApps} apps
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                {installedCount} installed
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text} opacity-50`}>
                {presentCount} present
              </button>
              <button className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                {configsRestored} settings restored
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {SETUP_EVENTS.map((event, i) => {
                const uiStatus = getPhaseAwareStatusForEvent({ statusKey: event.statusKey, phase: 'apply', reason: event.reason });
                const colors = getColorClasses(uiStatus.color);
                const hasSettings = event.app in SETUP_CONFIG_MAP;
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

          <div className="flex items-center gap-3 mt-6">
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

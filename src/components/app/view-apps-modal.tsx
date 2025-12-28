import { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-bridge';
import { parseJsonc, type ProfileApp } from '@/lib/jsonc-parse';
import { CaptureResultModal } from './capture-result-modal';
import type { CapturedApp } from '@/types';

interface ViewAppsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profilePath: string;
  profileDisplayName: string;
}

interface ParsedProfile {
  apps: ProfileApp[];
  error?: string;
}

async function loadProfileApps(path: string): Promise<ParsedProfile> {
  try {
    const content = await invoke<string>('read_text_file', { path });
    const parsed = parseJsonc<{ apps?: ProfileApp[] }>(content);
    
    if (!parsed.apps || !Array.isArray(parsed.apps)) {
      return { apps: [], error: 'Profile has no apps array' };
    }
    
    return { apps: parsed.apps };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { apps: [], error: `Failed to parse profile: ${message}` };
  }
}

export function ViewAppsModal({
  open,
  onOpenChange,
  profilePath,
  profileDisplayName,
}: ViewAppsModalProps) {
  const [apps, setApps] = useState<ProfileApp[]>([]);

  useEffect(() => {
    if (open && profilePath) {
      loadProfileApps(profilePath).then((result) => {
        setApps(result.apps || []);
      });
    }
  }, [open, profilePath]);

  // Convert ProfileApp[] to CapturedApp[] for Capture Details modal
  const capturedApps: CapturedApp[] = apps.map(app => ({
    id: app.id,
    source: app.driver || 'winget',
  }));

  // Reuse Capture Details modal with search enabled
  return (
    <CaptureResultModal
      open={open}
      onClose={() => onOpenChange(false)}
      counts={{
        totalFound: apps.length,
        included: apps.length,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      }}
      appsIncluded={capturedApps}
      outputPath={profilePath}
      enableSearch={true}
      customTitle={profileDisplayName}
    />
  );
}

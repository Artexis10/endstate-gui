/**
 * SelectedProfileCard - Compact profile bar with inline selector
 */

import { FileText, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiscoveredProfile } from '@/file-discovery';
import type { BackupListItem } from '@/types';
import { ProfileCloudBadge } from '@/components/app/backup/profile-cloud-badge';

interface SelectedProfileCardProps {
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  isRunning: boolean;
  onProfileChange: (profile: string, path: string) => void;
  onManageProfiles: () => void;
  /** Map keyed by profile name — present entries get a cloud badge. */
  cloudBackupIndex?: Map<string, BackupListItem>;
}

export function SelectedProfileCard({
  selectedProfile,
  profiles,
  isRunning,
  onProfileChange,
  onManageProfiles,
  cloudBackupIndex,
}: SelectedProfileCardProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5"
      data-testid="current-profile-card-content"
    >
      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
      <Select
        value={selectedProfile}
        onValueChange={(value) => {
          const selected = profiles.find(p => p.name === value);
          onProfileChange(value, selected?.path || '');
        }}
        disabled={isRunning}
      >
        <SelectTrigger className="h-7 border-0 bg-transparent shadow-none px-0 gap-1.5 text-sm font-medium flex-1 min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => {
            const cloudEntry = cloudBackupIndex?.get(p.name);
            return (
              <SelectItem key={p.name} value={p.name}>
                <span className="inline-flex items-center gap-2">
                  <span>{p.displayName || p.name}</span>
                  {cloudEntry && (
                    <ProfileCloudBadge
                      cloudEntry={cloudEntry}
                      variant="compact"
                      testId={`selected-profile-card-${p.name}-cloud-badge`}
                    />
                  )}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onManageProfiles();
        }}
        disabled={isRunning}
        title="Manage profiles"
        aria-label="Manage profiles"
        data-testid="manage-profiles-button"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

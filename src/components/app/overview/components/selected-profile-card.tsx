/**
 * SelectedProfileCard - Shows the currently selected profile with selector
 */

import { FileText, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiscoveredProfile } from '@/file-discovery';

interface SelectedProfileCardProps {
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  isRunning: boolean;
  onProfileChange: (profile: string, path: string) => void;
  onManageProfiles: () => void;
}

export function SelectedProfileCard({
  selectedProfile,
  profiles,
  isRunning,
  onProfileChange,
  onManageProfiles,
}: SelectedProfileCardProps) {
  const currentProfile = profiles.find(p => p.name === selectedProfile);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4 space-y-3" data-testid="current-profile-card-content">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Selected Profile</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentProfile?.displayName 
                  ? `${currentProfile.displayName} (${selectedProfile})`
                  : selectedProfile}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedProfile}
              onValueChange={(value) => {
                const selected = profiles.find(p => p.name === value);
                onProfileChange(value, selected?.path || '');
              }}
              disabled={isRunning}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.displayName ? `${p.displayName} (${p.name})` : p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onManageProfiles();
              }}
              disabled={isRunning}
              title="Manage profiles"
              aria-label="Manage profiles"
              data-testid="manage-profiles-button"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

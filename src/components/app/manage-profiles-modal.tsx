import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, FolderOpen, RefreshCw, Eye, Play } from 'lucide-react';
import type { DiscoveredProfile } from '@/file-discovery';
import { ViewAppsModal } from './view-apps-modal';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';

interface ManageProfilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: DiscoveredProfile[];
  selectedProfile: string;
  profilesDirectory: string;
  onRenameDisplay: (path: string, currentName: string) => void;
  onRenameFile?: (path: string, currentFilename: string) => void;
  onDelete: (path: string, displayName: string) => void;
  onSetActive: (profile: DiscoveredProfile) => void;
  onOpenFolder: () => void;
  onRefresh: () => Promise<void>;
}

export function ManageProfilesModal({
  open,
  onOpenChange,
  profiles,
  selectedProfile,
  profilesDirectory,
  onRenameDisplay,
  onRenameFile,
  onDelete,
  onSetActive,
  onOpenFolder,
  onRefresh,
}: ManageProfilesModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewAppsProfile, setViewAppsProfile] = useState<DiscoveredProfile | null>(null);
  const refreshFeedback = useMicroFeedback();

  const getDisplayLabel = (profile: DiscoveredProfile): string => {
    return profile.displayName || profile.name;
  };

  const getFilename = (profile: DiscoveredProfile): string => {
    const parts = profile.path.split(/[/\\]/);
    return parts[parts.length - 1] || profile.name;
  };

  const isSelected = (profile: DiscoveredProfile): boolean => {
    return profile.name === selectedProfile;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Profiles</DialogTitle>
          <DialogDescription>
            Rename or delete profiles. You cannot delete the active profile.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1 py-2 bg-muted/30 rounded-md">
          <span className="text-xs text-muted-foreground font-medium">Profiles folder:</span>
          <span className="flex-1 text-xs font-mono truncate" title={profilesDirectory}>
            {profilesDirectory}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onOpenFolder}
          >
            <FolderOpen className="h-3 w-3 mr-1" />
            Open folder
          </Button>
          <Button
            ref={refreshFeedback.buttonRef}
            variant="ghost"
            size="sm"
            className="h-7 px-2 relative"
            onClick={async () => {
              setIsRefreshing(true);
              await refreshFeedback.triggerAsync(
                async () => {
                  await onRefresh();
                },
                'Refreshed',
                'Refresh failed'
              );
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
            <InlineFeedbackPopover feedback={refreshFeedback.feedback} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium">Profile</th>
                <th className="text-left p-3 text-sm font-medium">Filename</th>
                <th className="text-right p-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    No profiles found
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => {
                  const selected = isSelected(profile);
                  return (
                    <tr key={profile.path} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getDisplayLabel(profile)}</span>
                          {selected && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground font-mono">
                          {getFilename(profile)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {!selected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onSetActive(profile)}
                              title="Set as active profile"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Set active
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setViewAppsProfile(profile)}
                            title="View profile details"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onRenameDisplay(profile.path, profile.displayName || '')}
                            title="Rename display name"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 ${
                              selected
                                ? 'text-muted-foreground cursor-not-allowed'
                                : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                            }`}
                            onClick={() => {
                              if (!selected) {
                                onDelete(profile.path, getDisplayLabel(profile));
                              }
                            }}
                            disabled={selected}
                            title={
                              selected
                                ? 'Select a different profile to delete this one'
                                : 'Delete profile'
                            }
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* View Apps Modal */}
      <ViewAppsModal
        open={viewAppsProfile !== null}
        onOpenChange={(open) => !open && setViewAppsProfile(null)}
        profilePath={viewAppsProfile?.path || ''}
        profileDisplayName={viewAppsProfile ? getDisplayLabel(viewAppsProfile) : ''}
        onRenameFile={onRenameFile}
      />
    </Dialog>
  );
}

import { useState } from 'react';
import { useShowDetails } from '@/lib/use-show-details';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, FolderOpen, RefreshCw, Eye, Play } from 'lucide-react';
import type { DiscoveredProfile } from '@/file-discovery';
import type { BackupListItem } from '@/types';
import { ViewAppsModal } from './view-apps-modal';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { ProfileStorageChip } from '@/components/app/backup/profile-storage-chip';
import { profileKeyFor } from '@/lib/profile-key';

interface ManageProfilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: DiscoveredProfile[];
  selectedProfile: string;
  profilesDirectory: string;
  pendingCaptureDraftPath?: string | null;
  onRenameDisplay: (path: string, currentName: string) => void;
  onDelete: (path: string, displayName: string) => void;
  onSetActive: (profile: DiscoveredProfile) => void;
  onOpenFolder: () => void;
  onRefresh: () => Promise<void>;
  /** Map keyed by profileKey (path) → hosted backup, resolved by id. */
  cloudBackupIndex?: Map<string, BackupListItem>;
}

export function ManageProfilesModal({
  open,
  onOpenChange,
  profiles,
  selectedProfile,
  profilesDirectory,
  pendingCaptureDraftPath,
  onRenameDisplay,
  onDelete,
  onSetActive,
  onOpenFolder,
  onRefresh,
  cloudBackupIndex,
}: ManageProfilesModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewAppsProfile, setViewAppsProfile] = useState<DiscoveredProfile | null>(null);
  const refreshFeedback = useMicroFeedback();
  const showDetails = useShowDetails();

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

  const isPendingDraft = (profile: DiscoveredProfile): boolean => {
    return !!pendingCaptureDraftPath && profile.path === pendingCaptureDraftPath;
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

        {showDetails && (
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
        )}

        <div className="flex-1 overflow-y-auto border rounded-md">
          <table className="w-full">
            <thead className="bg-background sticky top-0 z-10">
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium bg-background">Profile</th>
                {showDetails && (
                  <th className="text-left p-3 text-sm font-medium bg-background">Filename</th>
                )}
                <th className="text-right p-3 text-sm font-medium bg-background">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Filter out drafts - they are NOT profiles and should not appear here
                // Per contract: drafts handled exclusively in Capture card
                const savedProfiles = profiles.filter(p => !isPendingDraft(p));
                
                if (savedProfiles.length === 0) {
                  return (
                    <tr>
                      <td colSpan={showDetails ? 3 : 2} className="p-8 text-center text-muted-foreground">
                        No profiles found
                      </td>
                    </tr>
                  );
                }
                
                return savedProfiles.map((profile) => {
                  const selected = isSelected(profile);
                  return (
                    <tr key={profile.path} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getDisplayLabel(profile)}</span>
                          {selected && (
                            <span className="text-xs bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded font-medium">
                              Active
                            </span>
                          )}
                          <ProfileStorageChip
                            cloudEntry={cloudBackupIndex?.get(profileKeyFor(profile))}
                            testId={`manage-profiles-${profile.name}-storage-chip`}
                          />
                        </div>
                      </td>
                      {showDetails && (
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground font-mono">
                            {getFilename(profile)}
                          </span>
                        </td>
                      )}
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
                              selected || isPendingDraft(profile)
                                ? 'text-muted-foreground cursor-not-allowed'
                                : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                            }`}
                            onClick={() => {
                              if (!selected && !isPendingDraft(profile)) {
                                onDelete(profile.path, getDisplayLabel(profile));
                              }
                            }}
                            disabled={selected || isPendingDraft(profile)}
                            title={
                              selected
                                ? 'Select a different profile to delete this one'
                                : isPendingDraft(profile)
                                ? 'Cannot delete unsaved draft. Save or discard the draft first.'
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
                });
              })()}
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
      />
    </Dialog>
  );
}

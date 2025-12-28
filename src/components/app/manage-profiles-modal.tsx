import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, AlertCircle, FolderOpen, RefreshCw, Eye } from 'lucide-react';
import type { DiscoveredProfile } from '@/file-discovery';
import { ViewAppsModal } from './view-apps-modal';

interface ManageProfilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: DiscoveredProfile[];
  selectedProfile: string;
  profilesDirectory: string;
  onRenameDisplay: (path: string, currentName: string) => void;
  onRenameFile: (path: string, currentName: string) => void;
  onDelete: (path: string, displayName: string) => void;
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
  onOpenFolder,
  onRefresh,
}: ManageProfilesModalProps) {
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewAppsProfile, setViewAppsProfile] = useState<DiscoveredProfile | null>(null);

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
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Manage Profiles</DialogTitle>
              <DialogDescription>
                Rename or delete profiles. You cannot delete the selected profile.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="advanced-mode" className="text-sm text-muted-foreground">
                Advanced
              </label>
              <Switch
                id="advanced-mode"
                checked={advancedMode}
                onCheckedChange={setAdvancedMode}
              />
            </div>
          </div>
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
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
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
                              Selected
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setViewAppsProfile(profile)}
                            title="View apps in this profile"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View apps
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
                          {advancedMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onRenameFile(profile.path, getFilename(profile))}
                              title="Change filename on disk"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Change filename
                            </Button>
                          )}
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

        {advancedMode && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-muted-foreground">
              <strong>Advanced mode:</strong> Change filename renames the manifest file on disk along with its metadata file.
            </div>
          </div>
        )}

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

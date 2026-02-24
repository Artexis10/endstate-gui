/**
 * SetupFlow - Placeholder for the Set up (import + apply) flow (ADR-001)
 *
 * Presents a drop zone for zip/manifest import alongside a list of existing
 * profiles. Profile management (rename, delete, inspect) lives here as
 * contextual actions on profile cards.
 *
 * This is the structural shell. Full implementation is a separate change.
 */

import { motion } from 'framer-motion';
import { ArrowLeft, Download, FolderOpen, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropZone } from './drop-zone';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import type { DiscoveredProfile } from '@/file-discovery';

interface SetupFlowProps {
  profiles: DiscoveredProfile[];
  onBack: () => void;
  onProfileSelect: (profile: DiscoveredProfile) => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onFileDrop: (files: File[]) => void;
}

export function SetupFlow({
  profiles,
  onBack,
  onProfileSelect,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onFileDrop,
}: SetupFlowProps) {
  const [refreshing, setRefreshing] = useState(false);
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshProfiles();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={transition}
      className="min-h-[calc(100vh-4rem)]"
      data-testid="setup-flow"
    >
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="setup-flow-back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-green-500/10">
          <Download className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Set up this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import a saved setup or choose a profile to install your apps
          </p>
        </div>
      </div>

      {/* Drop zone for import */}
      <div className="mb-8">
        <DropZone onFileDrop={onFileDrop} />
      </div>

      {/* Profile list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">
            {profiles.length > 0
              ? `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'} available`
              : 'No profiles found'}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onOpenProfilesFolder}>
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Open folder
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {profiles.length > 0 ? (
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <Card
                key={profile.name}
                className="cursor-pointer hover:border-green-500/50 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-500/50"
                onClick={() => onProfileSelect(profile)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onProfileSelect(profile);
                  }
                }}
                tabIndex={0}
                role="button"
                data-testid={`profile-card-${profile.name}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {profile.displayName || profile.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.name}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      tabIndex={-1}
                    >
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Drop a zip bundle or manifest file above, or place profile files
                in your Profiles folder.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

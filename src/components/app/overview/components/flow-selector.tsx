/**
 * FlowSelector - Dual-flow primary UI for the Overview
 *
 * Presents two user journeys side by side:
 *   A) "Save this computer" → Capture flow
 *   B) "Set up this machine" → Apply flow (select a profile)
 *
 * When a flow is active, action content renders inline via slots.
 * activeFlow is controlled by the parent via use-overview-state.
 */

import { type ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { ScanSearch, PlayCircle, ArrowLeft, FolderOpen, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import type { DiscoveredProfile } from '@/file-discovery';
import type { ActiveFlow } from '../types';

interface FlowSelectorProps {
  activeFlow: ActiveFlow;
  setActiveFlow: (flow: ActiveFlow) => void;
  profiles: DiscoveredProfile[];
  selectedProfile: string;
  hasProfile: boolean;
  engineConnected: boolean;
  isRunning: boolean;
  onProfileChange: (profile: string, path: string) => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onBack: () => void;
  captureActionSlot?: ReactNode;
  setupActionSlot?: ReactNode;
}

export function FlowSelector({
  activeFlow,
  setActiveFlow,
  profiles,
  selectedProfile,
  hasProfile,
  engineConnected,
  isRunning,
  onProfileChange,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onBack,
  captureActionSlot,
  setupActionSlot,
}: FlowSelectorProps) {
  const [refreshing, setRefreshing] = useState(false);
  const reduced = prefersReducedMotion();
  const disabled = !engineConnected || isRunning;

  const handleSelectCapture = () => {
    if (disabled) return;
    setActiveFlow('capture');
  };

  const handleSelectSetup = () => {
    if (disabled) return;
    setActiveFlow('setup');
  };

  const handleCaptureInstead = () => {
    setActiveFlow('capture');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshProfiles();
    } finally {
      setRefreshing(false);
    }
  };

  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const selectedProfileDisplay = hasProfile
    ? profiles.find(p => p.name === selectedProfile)?.displayName || selectedProfile
    : '';

  // ── Split view (default) ──────────────────────────────────────────────
  if (activeFlow === 'none') {
    return (
      <motion.div
        key="split"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        data-testid="flow-selector"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Flow A: Save this computer */}
          <Card
            className={`border-l-2 border-l-blue-500/50 transition-all duration-200 outline-none ${
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:border-l-blue-500 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500/50'
            }`}
            onClick={handleSelectCapture}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectCapture(); } }}
            tabIndex={disabled ? -1 : 0}
            role="button"
            data-testid="flow-capture"
          >
            <CardContent className="py-8 px-6 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-2xl bg-blue-500/10">
                <ScanSearch className="h-7 w-7 text-blue-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">Save this computer</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scan your installed apps and save them as a profile
                </p>
              </div>
              <Button
                size="default"
                disabled={disabled}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                tabIndex={-1}
              >
                Save
              </Button>
            </CardContent>
          </Card>

          {/* Flow B: Set up this machine */}
          <Card
            className={`border-l-2 border-l-green-500/50 transition-all duration-200 outline-none ${
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:border-l-green-500 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-green-500/50'
            }`}
            onClick={handleSelectSetup}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectSetup(); } }}
            tabIndex={disabled ? -1 : 0}
            role="button"
            data-testid="flow-setup"
          >
            <CardContent className="py-8 px-6 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-2xl bg-green-500/10">
                <PlayCircle className="h-7 w-7 text-green-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">Set up this machine</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Install apps from a saved profile
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button
                  size="default"
                  disabled={disabled}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  tabIndex={-1}
                >
                  Set up
                </Button>
                {profiles.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} available
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    );
  }

  // ── Expanded: Capture flow ────────────────────────────────────────────
  if (activeFlow === 'capture') {
    return (
      <motion.div
        key="capture-expanded"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        data-testid="flow-capture-expanded"
      >
        {!isRunning && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            data-testid="flow-back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to flow selection
          </button>
        )}

        <Card className="border-l-2 border-l-blue-500 border-blue-500/50 shadow-md shadow-blue-500/5">
          <CardContent className="py-6 px-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ScanSearch className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Save this computer</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Scan your installed apps and save them as a profile</p>
              </div>
            </div>
            {captureActionSlot}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ── Expanded: Setup flow ──────────────────────────────────────────────
  // If no profile is selected, show the profile picker.
  // If a profile is selected, show the setup action content inline.
  const needsProfilePicker = !hasProfile;

  return (
    <motion.div
      key="setup-expanded"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
      data-testid="flow-setup-expanded"
    >
      {!isRunning && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          data-testid="flow-back-button"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to flow selection
        </button>
      )}

      {needsProfilePicker ? (
        /* No profile selected — show profile picker */
        <>
          {profiles.length > 0 ? (
            <Card className="border-l-2 border-l-green-500" data-testid="flow-setup-profile-picker">
              <CardContent className="py-8 px-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-green-500/10">
                    <PlayCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">Choose a profile</h3>
                    <p className="text-xs text-muted-foreground">
                      Select the setup profile you want to apply to this machine
                    </p>
                  </div>
                </div>

                <Select
                  onValueChange={(value) => {
                    const selected = profiles.find(p => p.name === value);
                    if (selected) {
                      onProfileChange(selected.name, selected.path);
                    }
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="flow-profile-select">
                    <SelectValue placeholder="Select a profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.displayName || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-3 pt-1">
                  <Button variant="ghost" size="sm" onClick={onOpenProfilesFolder}>
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    Open profiles folder
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-l-2 border-l-green-500 border-dashed" data-testid="flow-setup-empty">
              <CardContent className="py-8 px-6 text-center space-y-5">
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold">No setup profiles found</h3>
                  <p className="text-sm text-muted-foreground">
                    Drop a profile file into your Profiles folder, or capture this computer first.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button variant="secondary" onClick={onOpenProfilesFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open profiles folder
                  </Button>
                  <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <button
                  onClick={handleCaptureInstead}
                  className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
                >
                  &larr; Save this computer instead
                </button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Profile selected — show setup action content inline */
        <Card className="border-l-2 border-l-green-500 border-green-500/50 shadow-md shadow-green-500/5">
          <CardContent className="py-6 px-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-green-500/10">
                <PlayCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Set up this machine</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Using profile: {selectedProfileDisplay}
                </p>
              </div>
            </div>
            {setupActionSlot}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
